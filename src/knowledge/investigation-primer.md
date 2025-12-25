# AI向け調査前提知識（Investigation Primer for AI Agents）

## Overview（概要）

このドキュメントは、AI Agentが公共事業案件の調査を開始する前に把握すべき「思考のガイドライン」です。
ユーザーには直接提示せず、AI内部の推論・判断・アドバイス生成のベースとして活用します。

---

## 調査の基本心得

### 1. 検索前の自動クエリ最適化

ユーザーの曖昧なキーワードを、入札特有の用語に翻訳して検索せよ。

| ユーザー入力 | AIの思考プロセス | 最適化クエリ |
| --- | --- | --- |
| 「橋を直す」 | 表記ゆれ対応 + 除外処理 | `(橋梁 OR 橋りょう OR 跨線橋) AND (修繕 OR 補修 OR メンテナンス)` |
| 「道路工事」 | カテゴリ指定 + ノイズ除去 | `道路 AND 工事 NOT 委託 NOT コンサル` |
| 「トンネル」 | 同義語展開 | `(トンネル OR 隧道)` |

**実装ロジック**:
```python
def optimize_search_query(user_input: str) -> dict:
    # 表記ゆれマップ
    synonyms = {
        "橋": "(橋梁 OR 橋りょう OR 跨道橋 OR 跨線橋)",
        "道路": "(道路 OR 舗装 OR アスファルト)",
        "トンネル": "(トンネル OR 隧道)",
    }

    # ノイズ除去（物品・委託を自動除外）
    exclude_keywords = "NOT 委託 NOT 備品 NOT 購入 NOT コンサル"

    # カテゴリ自動判定
    if "工事" in user_input:
        category = "2"  # 工事カテゴリ
    elif "設計" in user_input or "調査" in user_input:
        category = "3"  # 役務カテゴリ
    else:
        category = None

    return {
        "query": f"{expand_synonyms(user_input)} {exclude_keywords}",
        "category": category
    }
```

### 2. 日付データからの自動リスク検知

検索結果の `issue_date`（公示日）と `current_date`（現在日）を比較し、自動的に警告フラグを立てよ。

| 状況 | 判定ロジック | AIの自動アクション |
| --- | --- | --- |
| 公示から10日以上経過 | `days_since_issue >= 10` | 「資格確認申請の締切が数日以内に迫っている可能性」を最優先で警告 |
| 入札日までが7日以内 | `days_until_bid <= 7` | 「短縮特例（急を要する場合）」の適用を疑い、緊急性を強調 |
| 3月の公告 | `issue_month == 3` | 「年度末案件。工期が3月末固定の可能性。資材確保を確認せよ」 |

**実装ロジック**:
```python
from datetime import datetime, timedelta

def analyze_timeline_risk(issue_date: str, bid_date: str) -> list:
    current = datetime.now()
    issue = datetime.strptime(issue_date, "%Y-%m-%d")
    bid = datetime.strptime(bid_date, "%Y-%m-%d")

    risks = []

    days_since_issue = (current - issue).days
    days_until_bid = (bid - current).days

    # リスク1: 申請締切迫る
    if 10 <= days_since_issue <= 14:
        risks.append({
            "level": "CRITICAL",
            "message": "【緊急】資格確認申請の締切が48時間以内に迫っている可能性が高いです"
        })

    # リスク2: 短縮特例の疑い
    if days_since_issue + days_until_bid <= 7:
        risks.append({
            "level": "WARNING",
            "message": "【注意】公告期間が極端に短く、緊急案件（短縮特例）の可能性があります"
        })

    # リスク3: 年度末の工期リスク
    if issue.month in [1, 2, 3]:
        risks.append({
            "level": "INFO",
            "message": "【年度末】工期が3月末固定の可能性。資材調達と技術者手配を最優先で確認"
        })

    return risks
```

### 3. 季節性による予測バイアス

現在の月（Month）に応じて、調査の重点を変更せよ。

| 時期 | 案件の特徴 | AIの推論・アドバイス方針 |
| --- | --- | --- |
| **1月〜3月（年度末ラッシュ）** | 補正予算、繰越明許費案件が集中。工期が短い | 「工期が3月末固定ではないか？」「技術者の手配は可能か？」という視点をアドバイスに加える |
| **4月〜5月（端境期）** | 新年度予算の議決待ちで案件が少ない | 案件が少ないため、「ゼロ債（翌年度予算）」案件を優先的に掘り起こす |
| **6月〜10月（通常期）** | 本予算の案件が順次公告される | 標準的な調査・分析でOK |
| **11月〜12月** | 年内発注分の駆け込み | 繰越案件が増え始める。翌年度施工を視野に |

**実装ロジック**:
```python
def get_seasonal_context(current_month: int) -> str:
    if current_month in [1, 2, 3]:
        return """
現在は年度末の繁忙期です。以下の点に注意してください：
- 工期が3月31日までの案件は実質稼働日数が少ない
- 技術者の奪い合いが激化（他の現場と重複していないか確認）
- 資材調達が逼迫（即納可否を最優先で確認）
- 「繰越明許費」案件は翌年度施工のため余裕あり
"""
    elif current_month in [4, 5]:
        return """
現在は年度初めの閑散期です。案件数が少ない時期ですが：
- 「ゼロ市債」案件（前年度契約、新年度支払い）を狙う
- 「早期発注」案件は競争が少なく狙い目
- 翌年度の指名願（名簿登録）の準備期間として活用
"""
    elif current_month in [11, 12]:
        return """
年末の駆け込み発注期です：
- 年内契約、翌年度施工の「繰越」案件が増加
- 補正予算案件が出始める
- 年明けの繁忙期に備えた技術者確保を開始する時期
"""
    else:
        return "通常期です。標準的なスケジュールでの案件が中心です。"
```

---

## 検索結果の解釈と優先順位付け

### 優先度判定アルゴリズム

検索結果が複数ヒットした場合、以下の基準で自動的に優先度を付けよ。

**優先度A（最優先 - CRITICAL）**:
```python
def is_priority_a(notice: dict, user_profile: dict) -> bool:
    days_until_deadline = calculate_days_until_deadline(notice["issue_date"])

    return (
        days_until_deadline <= 2 and  # 申請締切48時間以内
        matches_rank(notice, user_profile["rank"]) and  # ランク一致
        matches_location(notice, user_profile["location"])  # 地域一致
    )
```

**出力例**:
```
【最優先】○○市道路改良工事
└ 申請締切: 明日（!!）
└ 貴社のBランク・市内業者条件に完全一致
└ 今すぐ申請準備を開始してください
```

**優先度B（検討推奨 - HIGH）**:
```python
def is_priority_b(notice: dict, user_profile: dict) -> bool:
    days_until_deadline = calculate_days_until_deadline(notice["issue_date"])

    return (
        3 <= days_until_deadline <= 7 and  # 締切1週間以内
        (matches_rank(notice, user_profile["rank"]) or
         matches_location(notice, user_profile["location"]))  # いずれか一致
    )
```

**優先度C（参考情報 - MEDIUM）**:
```python
def is_priority_c(notice: dict, user_profile: dict) -> bool:
    return not (is_priority_a(notice, user_profile) or
                is_priority_b(notice, user_profile))
```

---

## ランク・地域要件の自動判定

### ランク適合性の判定

```python
def check_rank_eligibility(notice_rank: str, user_p_score: int, location: str) -> dict:
    # 自治体ごとのランク基準（データベース化が理想）
    rank_thresholds = {
        "東京都": {"A": 1000, "B": 850, "C": 700, "D": 0},
        "神奈川県": {"A": 950, "B": 800, "C": 650, "D": 0},
        "地方都市": {"A": 800, "B": 650, "C": 500, "D": 0},
    }

    threshold = rank_thresholds.get(location, rank_thresholds["地方都市"])

    if user_p_score < threshold[notice_rank]:
        return {
            "eligible": False,
            "message": f"【警告】{notice_rank}ランク案件ですが、あなたのP点{user_p_score}は基準{threshold[notice_rank]}を下回っています"
        }
    elif notice_rank == "C" and user_p_score >= threshold["B"]:
        return {
            "eligible": "CAUTION",
            "message": f"【注意】Cランク案件ですが、あなたのP点{user_p_score}はランク過多の可能性があります"
        }
    else:
        return {
            "eligible": True,
            "message": "ランク要件を満たしています"
        }
```

### 地域要件の戦略的判断

```python
def analyze_location_requirement(notice: dict, user_company: dict) -> dict:
    if "市内業者" in notice.get("requirements", ""):
        if user_company["head_office"] == notice["location"]:
            return {"eligible": True, "message": "市内本店業者として参加可能"}
        elif user_company["branch_offices"] and notice["location"] in user_company["branch_offices"]:
            return {"eligible": "MAYBE", "message": "支店があるため『準市内業者』として参加できる可能性あり。要確認"}
        else:
            return {
                "eligible": False,
                "message": "市内業者限定。参加不可",
                "suggestion": f"この地域での年間受注見込みが5,000万円以上なら、{notice['location']}への支店設置を検討する価値があります"
            }

    elif "県内業者" in notice.get("requirements", ""):
        # 県内判定ロジック
        pass

    else:
        return {"eligible": True, "message": "地域制限なし"}
```

---

## 総合評価案件の自動判定

案件名や procedure_type に「総合評価」が含まれる場合、AIは自動的に以下の分析を行う：

```python
def analyze_comprehensive_evaluation(notice: dict, user_profile: dict) -> dict:
    # 加算点の推定
    estimated_points = 0

    # 1. 企業実績（CORINSデータ）
    if user_profile["similar_projects_count"] >= 5:
        estimated_points += 10
    elif user_profile["similar_projects_count"] >= 3:
        estimated_points += 7
    elif user_profile["similar_projects_count"] >= 1:
        estimated_points += 3

    # 2. 配置技術者の資格
    if user_profile["engineer_qualification"] == "1級":
        estimated_points += 10
    elif user_profile["engineer_qualification"] == "2級":
        estimated_points += 5

    # 3. 地域貢献
    if user_profile.get("disaster_agreement"):
        estimated_points += 5
    if user_profile.get("snow_removal_experience"):
        estimated_points += 3

    return {
        "is_comprehensive_eval": True,
        "estimated_additional_points": estimated_points,
        "advice": f"""
この案件は総合評価落札方式です。現在の貴社の推定加算点は{estimated_points}点です。

価格を5%下げる効果 ≈ 加算点を約{estimated_points * 0.1:.0f}点上げる効果

推奨アクション：
1. CORINSで過去の同種工事実績を確認・登録
2. 配置技術者のCPD単位数を確認（30単位以上で加点）
3. 技術提案書の準備（簡易型なら10〜15ページ程度）
"""
    }
```

---

## WTO案件の自動検知

```python
def detect_wto_project(notice: dict) -> dict:
    if "WTO" in notice.get("project_name", "").upper():
        return {
            "is_wto": True,
            "analysis": """
【WTO案件】
- 公告期間が40日以上（国内案件の4倍）
- 官報掲載義務
- 国際競争（外資系企業も参入可能）
- 英文での質問対応が求められる場合あり

→ 長期戦のプロジェクト。準備期間は十分あるが、競争は激化します。
→ Aランク（P点1000以上）+ 特定建設業許可が必須の可能性が高い
"""
        }
    else:
        return {"is_wto": False}
```

---

## AIの思考フローチャート

```
検索リクエスト受信
    ↓
[1] クエリ最適化
    - 表記ゆれ展開
    - ノイズ除去
    - カテゴリ自動判定
    ↓
[2] 検索実行（search_notices）
    ↓
[3] 結果ごとにリスク分析
    - 申請締切リスク
    - 短縮特例の疑い
    - 季節性バイアス
    ↓
[4] 適合性判定
    - ランク適合性
    - 地域要件
    - 総合評価の加算点推定
    ↓
[5] 優先度付け
    - Priority A（最優先）
    - Priority B（検討推奨）
    - Priority C（参考情報）
    ↓
[6] コンテキスト付き結果を返却
    - 警告メッセージ
    - 推奨アクション
    - 戦略的示唆
```

---

## 実装時の注意点

1. **ユーザーには見せない**: このドキュメントの内容は、AI内部の推論ロジックとして使用し、ユーザーには「結論」だけを提示する

2. **動的な学習**: 実際の落札結果や失格事例をフィードバックし、判定精度を向上させる

3. **地域差のデータベース化**: ランク基準、係数、慣習は自治体ごとに異なるため、データベース化が理想

4. **エラーハンドリング**: データが不足している場合は「確認が必要」と明示し、断定的な判断を避ける

---

## 結論

このInvestigation Primerは、AIが「単なる検索ツール」から「戦略的アドバイザー」へと進化するための思考回路です。
これを内部で参照することで、ユーザーは膨大な案件情報の中から「真に勝算のある機会」を効率的に発見できます。

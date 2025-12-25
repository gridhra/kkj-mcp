/**
 * 官公需情報ポータルサイトAPI 型定義
 */

/**
 * 案件情報の型定義
 */
export interface Notice {
  ResultId: string;
  Key?: string; // 案件の詳細ページURLを生成するためのキー（Base64エンコード済み）
  ProjectName: string;
  OrganizationName: string;
  CftIssueDate: string;
  ProjectDescription?: string;
  ExternalDocumentURI?: string;
  TenderSubmissionDeadline?: string;
  OpeningTendersEvent?: string;
  PeriodEndTime?: string;
  Category?: string;
  ProcedureType?: string;
  Certification?: string;
  LGCode?: string;
  [key: string]: unknown;
}

/**
 * 検索パラメータの型定義
 */
export interface SearchParams {
  Query?: string;
  Project_Name?: string;
  Organization_Name?: string;
  LG_Code?: string;
  Category?: '1' | '2' | '3'; // 1:物品, 2:工事, 3:役務
  Procedure_Type?: '1' | '2'; // 1:一般競争入札等
  Certification?: 'A' | 'B' | 'C' | 'D';
  CFT_Issue_Date?: string;
  Tender_Submission_Deadline?: string;
  Opening_Tenders_Event?: string;
  Period_End_Time?: string;
  Count?: string;
}

/**
 * APIレスポンスの型定義
 */
export interface ApiResponse {
  Results?: {
    SearchResults?: {
      SearchResult?: Notice | Notice[];
    };
  };
}

/**
 * ページネーション付き検索結果
 */
export interface PaginatedSearchResult {
  currentPage: number;
  totalAvailable: number;
  results: NoticeListItem[];
  hasNextPage: boolean;
}

/**
 * 検索結果一覧で返却する簡略化された案件情報
 */
export interface NoticeListItem {
  ResultId: string;
  ProjectName: string;
  OrganizationName: string;
  CftIssueDate: string;
  ExternalDocumentURI?: string;
}

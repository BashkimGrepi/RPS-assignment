export interface ReconciliationResult {
    pagesScanned: number;
    matchesSeen: number;
    insertedCount: number;
    duplicateCount: number;
    stoppedBecause: ReconciliationStopReason | null;
}

export type ReconciliationStopReason = "duplicate_page" | "max_pages_reached" | "no_more_data" | "error";
// In this file we call the legacy API to fetch the history of games
// we do not normalize the response to any format here
import { env } from "../config/env.js";
import { fetchWithToken } from "../utils/fetchWithToken.js";
import { LegacyGame } from "../types/rps-dto.js";

type HistoryResponse = {
    data: LegacyGame[];
    cursor?: string | null;
}

export const fetchHistoryPage = async (cursorUrl?: string | null): Promise<HistoryResponse> => {
    const url = cursorUrl? `${env.LEGACY_API_BASE_URL}/history${cursorUrl}`: `${env.LEGACY_API_BASE_URL}/history`;
    return await fetchWithToken<HistoryResponse>(url);
};
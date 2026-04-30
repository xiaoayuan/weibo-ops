export async function readJsonResponse<T>(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `请求失败（HTTP ${response.status}）`);
  }
}

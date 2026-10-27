/** Keep the identity after a timeout, including page reload. Do not store notes,
 * dates or recipients. Changed content under an unresolved id is rejected by the
 * server rather than risking a second action after an ambiguous response.
 */
export function callbackRequestIdentity(url: string, storage: Pick<Storage, "getItem" | "setItem">, uuid = () => crypto.randomUUID()) {
  const key = `indexus:callback-request:${url}`;
  const saved = storage.getItem(key);
  if (saved) return saved;
  const id = uuid();
  storage.setItem(key, id);
  return id;
}
export function acknowledgeCallbackRequest(url: string, storage: Pick<Storage, "removeItem">) {
  storage.removeItem(`indexus:callback-request:${url}`);
}

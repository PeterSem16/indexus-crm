/** Keep legacy record links and snapshot/history parameters inside the host tab. */
export function healthcareLegalEntitiesUrl(search = "") {
  const params = new URLSearchParams(search);
  params.set("tab", "legal-entities");
  return `/hospitals?${params.toString()}`;
}

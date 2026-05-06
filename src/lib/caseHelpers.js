const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function toCamel(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[snakeToCamel(k)] = v;
  }
  return result;
}

export function toCamelArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(toCamel);
}

// users 테이블 행은 화면 호환을 위해 authId를 userId로도 노출
export function userToCamel(row) {
  const camel = toCamel(row);
  if (camel && "authId" in camel) camel.userId = camel.authId;
  return camel;
}

export function userToCamelArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(userToCamel);
}

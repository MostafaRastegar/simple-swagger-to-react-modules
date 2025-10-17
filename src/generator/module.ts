export function generateModule(spec: any) {
  if (!spec) return "";
  const content = `export const swaggerSpec = ${JSON.stringify(
    spec,
    null,
    2
  )};`;
  return content;
}

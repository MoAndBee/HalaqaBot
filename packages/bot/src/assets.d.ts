// Wrangler bundles images as Data modules (see the rules in wrangler.toml).
declare module "*.jpeg" {
  const data: ArrayBuffer;
  export default data;
}

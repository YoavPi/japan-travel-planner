/* Client-side admin check (mirrors ADMIN_EMAILS on the server). Admins have no
   map/generation caps. Keep this list in sync with api/generate-trip.js. */
const ADMIN_EMAILS = ["yoav.pintel@gmail.com"];

export const isAdminEmail = (email) =>
  !!email && ADMIN_EMAILS.includes(String(email).trim().toLowerCase());

export default isAdminEmail;

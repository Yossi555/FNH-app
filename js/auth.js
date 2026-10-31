// כניסה, יציאה וקריאת התפקיד.
// באב הטיפוס הכל עובר ל-js/mock/auth.js. בגרסה האמיתית: Supabase Auth,
// והתפקיד נקרא מ-app_metadata.role (ARCHITECTURE סעיף 3).

import * as mock from "./mock/auth.js";

let currentUser = mock.getSessionUser();

export async function login(userId, password) {
  const { user, error } = await mock.signIn(userId, password);
  if (error) throw new Error(error.message);
  currentUser = user;
  return user;
}

export async function logout() {
  await mock.signOut();
  currentUser = null;
}

export function getUser() {
  return currentUser;
}

export function isOwner() {
  return currentUser?.role === "owner";
}

import { createContext, useContext } from 'react';

/** The signed-in account ({ id, username, display_name, organisation, role, … }), shared by the desk and the Admin app. */
export const SessionContext = createContext(null);

export function useSessionUser() {
  return useContext(SessionContext);
}

/** "Gulf Monitor" for publishers, the person's name otherwise. */
export function accountName(user) {
  if (!user) return '';
  return user.organisation || user.display_name || user.username;
}

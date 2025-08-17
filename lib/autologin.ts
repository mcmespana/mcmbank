/**
 * Auto-login functionality for testing purposes
 * 
 * This module provides utilities for automatically logging in users
 * when the autologin feature flag is enabled.
 */

import { signIn } from '@/lib/actions/auth';

export interface AutoLoginCredentials {
  email: string;
  password: string;
}

/**
 * Default test credentials for auto-login
 * These are hardcoded for testing purposes as specified in requirements
 */
export const DEFAULT_AUTO_LOGIN_CREDENTIALS: AutoLoginCredentials = {
  email: 'admin@movimientoconsolacion.com',
  password: '1234',
};

/**
 * Performs automatic login with the provided credentials
 * Returns the result of the signIn action
 */
export async function performAutoLogin(
  credentials: AutoLoginCredentials = DEFAULT_AUTO_LOGIN_CREDENTIALS
) {
  try {
    // Create FormData to match the signIn action interface
    const formData = new FormData();
    formData.append('email', credentials.email);
    formData.append('password', credentials.password);

    // Call the existing signIn action
    const result = await signIn(null, formData);
    return result;
  } catch (error) {
    console.error('Auto-login error:', error);
    return { error: 'Auto-login failed' };
  }
}

/**
 * Delay utility for showing messages
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
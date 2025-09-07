import { test, expect } from '@playwright/test';

test('should navigate to the login page and see the login form', async ({ page }) => {
  await page.goto('/auth/login');

  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();

  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('should navigate to the sign-up page from the login page', async ({ page }) => {
  await page.goto('/auth/login');

  await page.getByRole('link', { name: '¿No tienes cuenta? Regístrate' }).click();

  await expect(page).toHaveURL('/auth/sign-up');

  await expect(page.getByRole('heading', { name: 'Crea una cuenta nueva' })).toBeVisible();
});

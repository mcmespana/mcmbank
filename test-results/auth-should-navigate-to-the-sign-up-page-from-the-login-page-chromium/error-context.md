# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - img [ref=e6]
    - img [ref=e11]
    - img [ref=e15]
    - generic [ref=e18]:
      - generic [ref=e19]:
        - img [ref=e21]
        - generic [ref=e25]: MCM Bank
        - generic [ref=e26]: Bienvenido a la aplicación de tesorería del MCM
      - generic [ref=e27]:
        - button "Entrar con Google" [ref=e28] [cursor=pointer]:
          - img
          - text: Entrar con Google
        - generic [ref=e34]: o
        - generic [ref=e35]:
          - generic [ref=e36]:
            - generic [ref=e37]: Mail MCM Local para el acceso
            - textbox "Mail MCM Local para el acceso" [ref=e38]
          - generic [ref=e39]:
            - generic [ref=e40]: Código de acceso
            - textbox "Código de acceso" [ref=e41]
          - button "Iniciar Sesión" [ref=e42] [cursor=pointer]: Iniciar Sesión
          - generic [ref=e44]:
            - text: ¿No tienes cuenta? Solicítala a tu responsable
            - link "desde aquí" [ref=e45] [cursor=pointer]:
              - /url: /auth/sign-up
        - generic [ref=e46]:
          - generic [ref=e49]: Seguro
          - generic [ref=e52]: Conectado
          - generic [ref=e55]: 24/7
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e63] [cursor=pointer]:
    - img [ref=e64] [cursor=pointer]
  - alert [ref=e67]
```
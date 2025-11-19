# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "Sacred Heart of Jesus Catholic School Logo" [ref=e8]
      - heading "Administrator Login" [level=3] [ref=e9]
      - paragraph [ref=e10]: Sacred Heart of Jesus Catholic School Library
    - generic [ref=e11]:
      - generic [ref=e12]:
        - alert [ref=e13]:
          - generic [ref=e14]: Login failed
        - generic [ref=e15]:
          - text: Username
          - textbox "Username" [ref=e16]:
            - /placeholder: Enter your username
            - text: librarian
        - generic [ref=e17]:
          - text: Password
          - generic [ref=e18]:
            - textbox "Password" [ref=e19]:
              - /placeholder: Enter your password
              - text: password123
            - button [ref=e20] [cursor=pointer]:
              - img [ref=e21]
        - generic [ref=e24]:
          - checkbox "Remember me" [ref=e25] [cursor=pointer]
          - checkbox
          - generic [ref=e26]: Remember me
        - button "Sign In" [ref=e27] [cursor=pointer]
      - generic [ref=e28]:
        - paragraph [ref=e29]: Authorized personnel only
        - paragraph [ref=e30]: Contact library administrator for access
  - region "Notifications alt+T"
  - generic [ref=e31]:
    - img [ref=e33]
    - button "Open Tanstack query devtools" [ref=e101] [cursor=pointer]:
      - img [ref=e102]
```
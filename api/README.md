# Arcade leaderboard — cPanel setup (helloly.at)

The leaderboard API is a single PHP file that runs on the same host as the
site, so there is no third party involved and no CORS to configure. The arcade
switches the board on automatically as soon as this endpoint answers.

## 1. Create the database (cPanel → MySQL Databases)
1. **Create a database**, e.g. `bjkarcade`.
   cPanel prefixes it with your account name → `ACCOUNT_bjkarcade`.
2. **Create a user**, e.g. `arcade` → `ACCOUNT_arcade`, with a strong password.
3. **Add the user to the database** and tick **All Privileges**.

## 2. Create the table (cPanel → phpMyAdmin)
Select the new database → **Import** → choose `schema.sql` → **Go**.

(Or paste the contents of `schema.sql` into the **SQL** tab and run it.)

## 3. Upload the API
Upload this whole `api/` folder to the site root, so it ends up at:

```
public_html/api/leaderboard.php
```

Then, **on the server**, copy the example config and fill in your credentials:

```
public_html/api/config.example.php  →  public_html/api/config.php
```

Edit `config.php` with the database name, user and password from step 1.

> `config.php` is gitignored — it must exist **only on the server**, never in
> the repo. Do not upload real credentials to GitHub.

## 4. Test
Visit this in a browser:

```
https://brendonjameskirk.com/api/leaderboard.php?game=snake
```

Expected (an empty board is correct before anyone plays):

```json
{"game":"snake","scores":[]}
```

Troubleshooting:
- `{"error":"not_configured"}` → `config.php` is missing.
- `{"error":"db_unavailable"}` → wrong credentials, or the user isn't attached
  to the database.
- A blank page or HTTP 500 → check cPanel → **Errors** / PHP error log.

Then open the arcade, press **L** (or the **BOARD** button) — it should show
"No scores yet". Play a game and you'll be asked for initials.

## Notes
- **Honour system**: scores are submitted by the browser and are not replay-
  validated. Per-game caps in `leaderboard.php` reject absurd values.
- **Names** are 1–3 characters `[A-Z0-9]`, with a small slur blocklist.
- Each game keeps only its **top 50** rows; the rest are pruned on insert.
- To clear a board, run in phpMyAdmin:
  `DELETE FROM scores WHERE game = 'snake';`
- Requires PHP 7.0+ with PDO MySQL (standard on cPanel).

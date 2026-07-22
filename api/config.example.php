<?php
// Copy this file to config.php on the server and fill in your real values.
//
//   cp config.example.php config.php
//
// config.php is gitignored on purpose — never commit real credentials.
// In cPanel the database and user names are usually prefixed with your
// account name, e.g. "brendon_bjkarcade" / "brendon_arcade".

return array(
    'host' => 'localhost',                  // cPanel MySQL is almost always localhost
    'name' => 'ACCOUNT_bjkarcade',          // database name from cPanel > MySQL Databases
    'user' => 'ACCOUNT_arcade',             // database user
    'pass' => 'REPLACE_WITH_REAL_PASSWORD', // that user's password

    // Browser origins allowed to POST scores (same-origin in practice).
    'origins' => array(
        'https://brendonjameskirk.com',
        'https://www.brendonjameskirk.com',
    ),
);

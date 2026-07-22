<?php
// api/leaderboard.php — global arcade leaderboard (same-origin, MySQL).
//
//   GET  /api/leaderboard.php?game=snake        -> { game, scores:[{name,score}, ...] }  top 10
//   POST /api/leaderboard.php  {game,name,score} -> same shape, after inserting
//
// Honour-system: scores are submitted by the client and cannot be fully
// verified server-side. We validate the shape, cap absurd values, sanitise the
// name, block a few slurs, and prune each game to its top 50.
//
// DB credentials live in config.php (gitignored). See config.example.php.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$GAME_CAPS = array(
    'snake'     => 100000,
    'breakout'  => 500000,
    'duck'      => 100000,
    'asteroids' => 1000000,
    '2048'      => 5000000,
);
$BLOCKED = array('ASS', 'FUK', 'FUC', 'FAG', 'NIG', 'CUM', 'SEX', 'TIT', 'JEW', 'KKK');
$KEEP_PER_GAME = 50;

function out($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    out(array('error' => 'not_configured'), 500);
}
$cfg = require $configFile;

try {
    $pdo = new PDO(
        'mysql:host=' . $cfg['host'] . ';dbname=' . $cfg['name'] . ';charset=utf8mb4',
        $cfg['user'],
        $cfg['pass'],
        array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        )
    );
} catch (Exception $e) {
    // never leak connection details to the client
    out(array('error' => 'db_unavailable'), 500);
}

function top_ten($pdo, $game) {
    $st = $pdo->prepare(
        'SELECT name, score FROM scores WHERE game = ? ORDER BY score DESC, created_at ASC LIMIT 10'
    );
    $st->execute(array($game));
    $rows = $st->fetchAll();
    foreach ($rows as $i => $row) {
        $rows[$i]['score'] = (int) $row['score'];
    }
    return $rows;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

// ---------- read the top 10 ----------
if ($method === 'GET') {
    $game = isset($_GET['game']) ? strtolower((string) $_GET['game']) : '';
    if (!isset($GAME_CAPS[$game])) {
        out(array('error' => 'bad_game'), 400);
    }
    try {
        out(array('game' => $game, 'scores' => top_ten($pdo, $game)));
    } catch (Exception $e) {
        out(array('error' => 'db_error'), 500);
    }
}

// ---------- submit a score ----------
if ($method === 'POST') {
    // Same-origin feature: reject browser posts coming from other sites.
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $allowed = isset($cfg['origins']) ? $cfg['origins'] : array();
    if ($origin !== '' && !in_array($origin, $allowed, true)) {
        out(array('error' => 'forbidden'), 403);
    }

    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        out(array('error' => 'bad_json'), 400);
    }

    $game  = isset($body['game']) ? strtolower((string) $body['game']) : '';
    $name  = isset($body['name']) ? strtoupper((string) $body['name']) : '';
    $name  = preg_replace('/[^A-Z0-9]/', '', $name);
    $name  = substr($name, 0, 3);
    $score = isset($body['score']) ? (int) $body['score'] : 0;

    if (!isset($GAME_CAPS[$game])) {
        out(array('error' => 'bad_game'), 400);
    }
    if ($name === '' || in_array($name, $BLOCKED, true)) {
        out(array('error' => 'bad_name'), 400);
    }
    if ($score <= 0 || $score > $GAME_CAPS[$game]) {
        out(array('error' => 'bad_score'), 400);
    }

    try {
        $st = $pdo->prepare('INSERT INTO scores (game, name, score, created_at) VALUES (?, ?, ?, ?)');
        $st->execute(array($game, $name, $score, time()));

        // keep each game's table small: drop everything below its top N
        $prune = $pdo->prepare(
            'DELETE FROM scores WHERE game = ? AND id NOT IN (' .
            '  SELECT id FROM (' .
            '    SELECT id FROM scores WHERE game = ? ORDER BY score DESC, created_at ASC LIMIT ' . (int) $KEEP_PER_GAME .
            '  ) AS keep_rows)'
        );
        $prune->execute(array($game, $game));

        out(array('game' => $game, 'scores' => top_ten($pdo, $game)));
    } catch (Exception $e) {
        out(array('error' => 'db_error'), 500);
    }
}

out(array('error' => 'method_not_allowed'), 405);

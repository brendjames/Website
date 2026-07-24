<?php
// api/contact.php — contact form handler (same host, no third party).
// Receives the contact form POST and emails it to the inbox via the server's
// mailer. Sanitises header fields to prevent email-header injection, uses a
// honeypot, and answers JSON for the site's fetch() or a redirect for no-JS.

$TO       = 'brendonkirk86@gmail.com';                 // where messages land
$FROM     = 'no-reply@brendonjameskirk.com';           // domain sender (SPF/DKIM friendly)
$SUBJECT  = 'New message from brendonjameskirk.com';
$MAX_MSG  = 5000;

// Does the caller want JSON (the site's fetch sets Accept: application/json)?
$wantsJson = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

function respond($ok, $wantsJson, $status = 200) {
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($status);
        echo json_encode(array('ok' => $ok));
    } else {
        // no-JS fallback: bounce back to the form with a flag it can read
        header('Location: /contact.html?sent=' . ($ok ? '1' : '0') . '#contact', true, 303);
    }
    exit;
}

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(false, $wantsJson, 405);
}

// honeypot: real people never fill this hidden field
if (!empty($_POST['_honey'])) {
    respond(true, $wantsJson); // pretend success — don't tip off bots
}

$name    = trim((string) ($_POST['name'] ?? ''));
$email   = trim((string) ($_POST['email'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

// validation
if ($name === '' || $email === '' || $message === '') {
    respond(false, $wantsJson, 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, $wantsJson, 400);
}
if (strlen($message) > $MAX_MSG || strlen($name) > 120) {
    respond(false, $wantsJson, 400);
}

// strip CR/LF from anything that touches a mail header (injection guard)
$safeName  = str_replace(array("\r", "\n"), ' ', $name);
$safeEmail = str_replace(array("\r", "\n"), '', $email);

$headers  = 'From: ' . $safeName . ' <' . $FROM . '>' . "\r\n";
$headers .= 'Reply-To: ' . $safeEmail . "\r\n";
$headers .= 'Content-Type: text/plain; charset=utf-8' . "\r\n";
$headers .= 'X-Mailer: brendonjameskirk.com';

$body  = "Name:  " . $name . "\n";
$body .= "Email: " . $email . "\n\n";
$body .= $message . "\n";

// -f sets the envelope sender, which helps deliverability under SPF
$sent = @mail($TO, $SUBJECT, $body, $headers, '-f ' . $FROM);

respond((bool) $sent, $wantsJson, $sent ? 200 : 500);

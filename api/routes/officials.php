<?php
// Team leader's personal official records (historical officials).

require_once __DIR__ . '/../xlsx.php';

$user = require_role([ROLE_LEADER]);

// ---- Excel template download ----------------------------------------------
if ($method === 'GET' && ($rest[0] ?? '') === 'template') {
    $rows = [[
        'Title', 'First Name', 'Last Name', 'KingsChat Username', 'Email Address', 'Team',
        'Phone Number', 'Accommodation', 'HQ Staff Member',
    ]];
    $widths = [12, 16, 16, 24, 28, 22, 16, 16, 16];
    $binary = xlsx_build($rows, 'Officials', $widths);
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="officials_template.xlsx"');
    header('Content-Length: ' . strlen($binary));
    echo $binary;
    exit;
}

// ---- Bulk upload -----------------------------------------------------------
if ($method === 'POST' && ($rest[0] ?? '') === 'bulk') {
    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        fail('Please choose an Excel (.xlsx) or CSV file to upload.', 422);
    }
    $upload = $_FILES['file'];
    if (($upload['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        fail('The upload failed. Please try again.', 422);
    }

    $rows = xlsx_read($upload['tmp_name']);
    if (!$rows) {
        fail('The file looks empty or could not be read.', 422);
    }

    $map = bulk_header_map($rows[0]);
    $required = ['first_name', 'last_name', 'kingschat_phone'];
    foreach ($required as $field) {
        if (!isset($map[$field])) {
            fail('The file is missing the required "' . $field . '" column.', 422);
        }
    }

    $added = 0;
    $skipped = 0;
    $errors = [];
    $seenPhones = [];

    for ($i = 1; $i < count($rows); $i++) {
        $line = $rows[$i];
        $rowNo = $i + 1; // 1-based row number as shown in Excel.
        $get = function (string $field) use ($line, $map): string {
            if (!isset($map[$field])) {
                return '';
            }
            return trim((string) ($line[$map[$field]] ?? ''));
        };

        $first = $get('first_name');
        $last = $get('last_name');
        $phone = preg_replace('/\s+/', '', $get('kingschat_phone'));

        // Skip fully blank rows silently.
        if ($first === '' && $last === '' && $phone === '' && $get('email') === '') {
            continue;
        }

        if ($first === '' || $last === '' || $phone === '') {
            $errors[] = ['row' => $rowNo, 'message' => 'First name, last name and phone are required.'];
            $skipped++;
            continue;
        }
        if (!valid_phone($phone)) {
            $errors[] = ['row' => $rowNo, 'message' => 'KingsChat phone must start with 234.'];
            $skipped++;
            continue;
        }
        if (isset($seenPhones[$phone])) {
            $errors[] = ['row' => $rowNo, 'message' => 'Duplicate phone in this file (also on row ' . $seenPhones[$phone] . ').'];
            $skipped++;
            continue;
        }
        $email = $get('email');
        if ($email !== '' && !valid_email($email)) {
            $errors[] = ['row' => $rowNo, 'message' => 'Email "' . $email . '" is not valid.'];
            $skipped++;
            continue;
        }

        // Officials are always tied to the leader's own team; any Team column
        // in the file is ignored.
        insert_official((int) $user['id'], [
            'title' => $get('title'),
            'first_name' => $first,
            'last_name' => $last,
            'kingschat_phone' => $phone,
            'kingschat_handle' => $get('kingschat_handle'),
            'email' => $email,
            'team_id' => normalize_team_id($user['team_id'] ?? null),
            'accommodation' => bulk_yes_no($get('accommodation')),
            'hq_staff_member' => bulk_yes_no($get('hq_staff_member')),
        ]);
        $seenPhones[$phone] = $rowNo;
        $added++;
    }

    ok(['added' => $added, 'skipped' => $skipped, 'errors' => $errors]);
}

// Maps a header row (any order) to our field names.
function bulk_header_map(array $header): array {
    $norm = function ($v): string {
        return preg_replace('/[^a-z]/', '', strtolower((string) $v));
    };
    $aliases = [
        'title' => ['title'],
        'first_name' => ['firstname', 'first', 'givenname'],
        'last_name' => ['lastname', 'last', 'surname', 'familyname'],
        'kingschat_phone' => ['kingschatphone', 'kingschatphonenumber', 'phone', 'phonenumber', 'mobile'],
        'kingschat_handle' => ['kingschathandle', 'handle', 'kingschatusername', 'username'],
        'email' => ['email', 'emailaddress'],
        'team' => ['team', 'teamname'],
        'accommodation' => ['accommodation', 'accomodation', 'accommodationyesno'],
        'hq_staff_member' => ['hqstaffmember', 'hqstaff', 'hq'],
    ];
    $lookup = [];
    foreach ($aliases as $field => $names) {
        foreach ($names as $n) {
            $lookup[$n] = $field;
        }
    }
    $map = [];
    foreach ($header as $idx => $label) {
        $key = $norm($label);
        if ($key !== '' && isset($lookup[$key]) && !isset($map[$lookup[$key]])) {
            $map[$lookup[$key]] = $idx;
        }
    }
    return $map;
}

function bulk_yes_no(string $value): int {
    $v = strtolower(trim($value));
    return in_array($v, ['yes', 'y', '1', 'true', 'x'], true) ? 1 : 0;
}

if (!isset($rest[0])) {
    if ($method === 'GET') {
        $search = trim((string) q('search', ''));
        $base = 'SELECT o.*, t.name AS team_name FROM officials o
                 LEFT JOIN teams t ON t.id = o.team_id WHERE o.owner_id = ?';
        if ($search !== '') {
            $stmt = db()->prepare(
                $base . ' AND (o.first_name LIKE ? OR o.last_name LIKE ? OR o.kingschat_phone LIKE ?
                      OR o.kingschat_handle LIKE ? OR o.email LIKE ? OR o.role LIKE ?)
                 ORDER BY o.last_name, o.first_name'
            );
            $like = '%' . $search . '%';
            $stmt->execute([$user['id'], $like, $like, $like, $like, $like, $like]);
        } else {
            $stmt = db()->prepare($base . ' ORDER BY o.last_name, o.first_name');
            $stmt->execute([$user['id']]);
        }
        ok($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $data = body();
        require_fields($data, ['first_name', 'last_name', 'kingschat_phone']);
        if (!valid_phone((string) $data['kingschat_phone'])) {
            fail('KingsChat phone must start with 234.', 422);
        }
        if (!empty($data['email']) && !valid_email((string) $data['email'])) {
            fail('Please enter a valid email address.', 422);
        }
        $id = insert_official((int) $user['id'], $data);
        $stmt = db()->prepare(
            'SELECT o.*, t.name AS team_name FROM officials o
             LEFT JOIN teams t ON t.id = o.team_id WHERE o.id = ?'
        );
        $stmt->execute([$id]);
        ok($stmt->fetch(), 201);
    }
    return false;
}

$id = (int) $rest[0];
$stmt = db()->prepare('SELECT * FROM officials WHERE id = ? AND owner_id = ?');
$stmt->execute([$id, $user['id']]);
$official = $stmt->fetch();
if (!$official) {
    fail('Official not found.', 404);
}

if ($method === 'PUT') {
    $data = body();
    if (!empty($data['email']) && !valid_email((string) $data['email'])) {
        fail('Please enter a valid email address.', 422);
    }
    $allowed = ['title', 'first_name', 'last_name', 'kingschat_phone', 'kingschat_handle', 'email', 'team_id', 'accommodation', 'hq_staff_member', 'role'];
    $sets = [];
    $vals = [];
    foreach ($allowed as $f) {
        if (!array_key_exists($f, $data)) {
            continue;
        }
        if ($f === 'kingschat_phone') {
            if (!valid_phone((string) $data[$f])) {
                fail('KingsChat phone must start with 234.', 422);
            }
            $sets[] = "$f = ?";
            $vals[] = preg_replace('/\s+/', '', (string) $data[$f]);
        } elseif ($f === 'accommodation' || $f === 'hq_staff_member') {
            $sets[] = "$f = ?";
            $vals[] = (int) $data[$f] ? 1 : 0;
        } elseif ($f === 'team_id') {
            $sets[] = "$f = ?";
            $vals[] = normalize_team_id($data[$f]);
        } else {
            $sets[] = "$f = ?";
            $vals[] = $data[$f];
        }
    }
    if ($sets) {
        $vals[] = $id;
        db()->prepare('UPDATE officials SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $stmt = db()->prepare(
        'SELECT o.*, t.name AS team_name FROM officials o
         LEFT JOIN teams t ON t.id = o.team_id WHERE o.id = ?'
    );
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($method === 'DELETE') {
    db()->prepare('DELETE FROM officials WHERE id = ?')->execute([$id]);
    ok(['deleted' => true]);
}

return false;

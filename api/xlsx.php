<?php
// Minimal XLSX reader/writer with no external dependencies (uses ZipArchive).
// Only the first worksheet is read/written, which is all the bulk import needs.

// ---- Helpers ---------------------------------------------------------------

function xlsx_col_letter(int $index): string {
    $s = '';
    $index++; // switch to 1-based
    while ($index > 0) {
        $mod = ($index - 1) % 26;
        $s = chr(65 + $mod) . $s;
        $index = intdiv($index - 1, 26);
    }
    return $s;
}

function xlsx_col_index(string $letters): int {
    $n = 0;
    $letters = strtoupper($letters);
    for ($i = 0; $i < strlen($letters); $i++) {
        $n = $n * 26 + (ord($letters[$i]) - 64);
    }
    return $n - 1;
}

function xlsx_esc(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function xlsx_decode(string $v): string {
    return html_entity_decode($v, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

// ---- Writer ----------------------------------------------------------------

// Builds a single-sheet workbook (.xlsx binary) from a 2D array of strings.
function xlsx_build(array $rows, string $sheetName = 'Sheet1', array $widths = []): string {
    $sheetName = trim(preg_replace('#[\\\\/\?\*\[\]:]#', '', $sheetName));
    if ($sheetName === '') {
        $sheetName = 'Sheet1';
    }
    $sheetName = mb_substr($sheetName, 0, 31);

    $cols = '';
    foreach ($widths as $i => $w) {
        $n = $i + 1;
        $cols .= '<col min="' . $n . '" max="' . $n . '" width="' . $w . '" customWidth="1"/>';
    }

    $sheetRows = '';
    $r = 1;
    foreach ($rows as $row) {
        $cells = '';
        $c = 0;
        foreach ($row as $val) {
            $cells .= '<c r="' . xlsx_col_letter($c) . $r . '" t="inlineStr"><is><t xml:space="preserve">'
                . xlsx_esc((string) $val) . '</t></is></c>';
            $c++;
        }
        $sheetRows .= '<row r="' . $r . '">' . $cells . '</row>';
        $r++;
    }

    $parts = [
        '[Content_Types].xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>',
        '_rels/.rels' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>',
        'xl/workbook.xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . xlsx_esc($sheetName) . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>',
        'xl/_rels/workbook.xml.rels' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>',
        'xl/styles.xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
            . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            . '</styleSheet>',
        'xl/worksheets/sheet1.xml' =>
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . ($cols !== '' ? '<cols>' . $cols . '</cols>' : '')
            . '<sheetData>' . $sheetRows . '</sheetData>'
            . '</worksheet>',
    ];

    $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    foreach ($parts as $name => $content) {
        $zip->addFromString($name, $content);
    }
    $zip->close();

    $data = file_get_contents($tmp);
    @unlink($tmp);
    return (string) $data;
}

// ---- Reader ----------------------------------------------------------------

function xlsx_read_csv(string $path): array {
    $rows = [];
    $h = fopen($path, 'r');
    if ($h === false) {
        return $rows;
    }
    while (($data = fgetcsv($h)) !== false) {
        $rows[] = array_map(function ($v) { return trim((string) $v); }, $data);
    }
    fclose($h);
    return $rows;
}

// Reads the first worksheet of an .xlsx file (or a .csv) into a 2D array of strings.
function xlsx_read(string $path): array {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if ($ext === 'csv') {
        return xlsx_read_csv($path);
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return xlsx_read_csv($path);
    }

    // Shared string table (optional).
    $shared = [];
    $ss = $zip->getFromName('xl/sharedStrings.xml');
    if ($ss !== false && preg_match_all('/<si\b[^>]*(?:\/>|>(.*?)<\/si>)/s', $ss, $m, PREG_SET_ORDER)) {
        foreach ($m as $si) {
            $body = $si[1] ?? '';
            $text = '';
            if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $body, $t)) {
                $text = implode('', $t[1]);
            }
            $shared[] = xlsx_decode($text);
        }
    }

    // Resolve the first worksheet path via the workbook relationships.
    $sheetPath = 'xl/worksheets/sheet1.xml';
    $wb = $zip->getFromName('xl/workbook.xml');
    $rels = $zip->getFromName('xl/_rels/workbook.xml.rels');
    if ($wb !== false && $rels !== false
        && preg_match('/<sheet\b[^>]*r:id="([^"]+)"/', $wb, $sm)
        && preg_match('/<Relationship\b[^>]*Id="' . preg_quote($sm[1], '/') . '"[^>]*Target="([^"]+)"/', $rels, $rm)) {
        $target = ltrim($rm[1], '/');
        $sheetPath = strpos($target, 'xl/') === 0 ? $target : 'xl/' . $target;
    }

    $xml = $zip->getFromName($sheetPath);
    if ($xml === false) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (preg_match('#^xl/worksheets/sheet\d+\.xml$#', $name)) {
                $xml = $zip->getFromName($name);
                break;
            }
        }
    }
    $zip->close();

    if ($xml === false) {
        return [];
    }

    $rows = [];
    if (preg_match_all('/<row\b[^>]*>(.*?)<\/row>/s', $xml, $rowMatches)) {
        foreach ($rowMatches[1] as $rowXml) {
            $cells = [];
            if (preg_match_all('/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/s', $rowXml, $cm, PREG_SET_ORDER)) {
                foreach ($cm as $cell) {
                    $attrs = $cell[1];
                    $inner = $cell[2] ?? '';
                    $col = 0;
                    if (preg_match('/\br="([A-Z]+)\d+"/', $attrs, $refm)) {
                        $col = xlsx_col_index($refm[1]);
                    }
                    $val = '';
                    if (preg_match('/\bt="([^"]+)"/', $attrs, $tm) && $tm[1] === 's') {
                        if (preg_match('/<v>(.*?)<\/v>/s', $inner, $vm)) {
                            $val = $shared[(int) $vm[1]] ?? '';
                        }
                    } elseif (preg_match('/\bt="([^"]+)"/', $attrs, $tm2) && $tm2[1] === 'inlineStr') {
                        $text = '';
                        if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $inner, $im)) {
                            $text = implode('', $im[1]);
                        }
                        $val = xlsx_decode($text);
                    } elseif (preg_match('/<v>(.*?)<\/v>/s', $inner, $vm)) {
                        $val = xlsx_decode($vm[1]);
                    }
                    $cells[$col] = trim($val);
                }
            }
            if (!$cells) {
                continue;
            }
            $max = max(array_keys($cells));
            $row = [];
            for ($i = 0; $i <= $max; $i++) {
                $row[$i] = $cells[$i] ?? '';
            }
            $rows[] = $row;
        }
    }
    return $rows;
}

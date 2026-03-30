$server = "192.168.0.145"
$user = "pbh"
$password = "prok3000"

$connString = "Server=$server;User Id=$user;Password=$password;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "
        SELECT 
            t.TABLE_NAME, 
            c.COLUMN_NAME, 
            c.DATA_TYPE, 
            c.CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.TABLES t
        JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
        WHERE t.TABLE_NAME LIKE 'TB_Chr%'
           OR t.TABLE_NAME LIKE 'TB_Mem%'
           OR t.TABLE_NAME LIKE 'VI_CHURCH%'
           OR t.TABLE_NAME LIKE 'VI_MIN%'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
    "
    $reader = $cmd.ExecuteReader()
    
    $outFile = ".\schema_dump.csv"
    $results = @()
    while ($reader.Read()) {
        $results += [PSCustomObject]@{
            TableName = $reader["TABLE_NAME"]
            ColumnName = $reader["COLUMN_NAME"]
            DataType = $reader["DATA_TYPE"]
            MaxLen = $reader["CHARACTER_MAXIMUM_LENGTH"]
        }
    }
    $reader.Close()
    
    $results | Export-Csv -Path $outFile -NoTypeInformation -Encoding UTF8
    Write-Host "Schema exported to $outFile"
} catch {
    Write-Error $_.Exception.Message
} finally {
    $conn.Close()
}

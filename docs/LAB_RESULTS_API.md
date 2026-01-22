# INDEXUS Lab Results API Documentation

## Overview

This API allows external laboratory systems (PHP or other) to submit lab results to the INDEXUS CRM system. Results are stored in the `collection_lab_results` table and linked to existing collections.

**Base URL:** `https://your-domain.com/api/v1`

**Content-Type:** `application/json`

---

## Authentication

All API requests must include an API key in the request headers.

### Header Options

```
Authorization: Bearer YOUR_API_KEY
```

or

```
X-API-Key: YOUR_API_KEY
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid API key |
| 403 | API key revoked or insufficient permissions |

---

## Endpoints

### 1. Submit Single Lab Result

**POST** `/api/v1/lab-results`

Submit a single lab result for a collection.

#### Request Body

```json
{
  "collectionId": "uuid-of-collection",
  "externalCollectionRef": "CBU-2024-001",
  "clientResultId": "LAB-RESULT-12345",
  
  "usability": "usable",
  "resultsDate": "2024-01-15T10:30:00Z",
  "labNote": "All parameters within normal range",
  
  "cbu": "CBU-2024-001",
  "collectionFor": "autologous",
  "processing": "standard",
  "title": "Dr.",
  "firstName": "Jana",
  "surname": "Novakova",
  "idBirthNumber": "9001011234",
  "dateOfCollection": "2024-01-10T08:00:00Z",
  "timeOfCollection": "08:00",
  "dateOfPrintingResults": "2024-01-15T10:00:00Z",
  "dateOfSendingResults": "2024-01-15T12:00:00Z",
  
  "sterility": "negative",
  "sterilityType": "aerobic",
  "reasonForCharge": null,
  "transplantProcessing": "ready",
  "resultOfSterility": "negative",
  "resultOfSterilityBagB": "negative",
  "infectionAgents": null,
  "letterToPediatrician": "sent",
  "status": "completed",
  "finalAnalyses": "approved",
  
  "tncCount": "1.2e9",
  "maxWeight": "150",
  "volume": "120",
  "volumeInBag": "100",
  "volumeInSyringesBagB": "20",
  "volumeOfCpdInSyr": "5",
  
  "umbilicalTissue": "collected",
  "tissueProcessed": "yes",
  "tissueSterility": "negative",
  "tissueInfectionAgents": null,
  "premiumStatus": "premium",
  "transferredTo": null,
  "tissueUsability": "usable",
  
  "bagAUsability": "usable",
  "bagAVolume": "80",
  "bagATnc": "0.9e9",
  "bagAAtbSensit": null,
  "bagABacteriaRisk": "low",
  "bagAInfectionAgent": null,
  "bagASignificance": "primary",
  
  "bagBUsability": "usable",
  "bagBVolume": "20",
  "bagBTnc": "0.3e9",
  "bagBAtbSensit": null,
  "bagBBacteriaRisk": "low",
  "bagBInfectionAgent": null,
  "bagBSignificance": "backup"
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `collectionId` OR `externalCollectionRef` | string | Reference to existing collection (UUID or CBU number) |
| `resultsDate` | ISO8601 | Date when results were generated |
| `usability` | string | Overall usability status |
| `status` | string | Processing status |

#### Optional Fields

All other fields are optional. See full schema below.

#### Success Response

**Status: 201 Created**

```json
{
  "success": true,
  "data": {
    "id": "generated-uuid",
    "collectionId": "linked-collection-uuid",
    "clientResultId": "LAB-RESULT-12345",
    "createdAt": "2024-01-15T12:30:00Z"
  },
  "message": "Lab result created successfully"
}
```

#### Error Responses

**Status: 400 Bad Request** - Validation errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "resultsDate",
        "message": "Invalid ISO8601 date format"
      },
      {
        "field": "usability",
        "message": "Required field missing"
      }
    ]
  }
}
```

**Status: 404 Not Found** - Collection not found

```json
{
  "success": false,
  "error": {
    "code": "COLLECTION_NOT_FOUND",
    "message": "Collection with provided reference not found"
  }
}
```

**Status: 409 Conflict** - Duplicate result

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_RESULT",
    "message": "Lab result with clientResultId already exists",
    "existingId": "existing-result-uuid"
  }
}
```

---

### 2. Submit Batch Lab Results

**POST** `/api/v1/lab-results/batch`

Submit multiple lab results in a single request (max 100 items).

#### Request Body

```json
{
  "results": [
    {
      "collectionId": "uuid-1",
      "clientResultId": "LAB-001",
      "usability": "usable",
      "resultsDate": "2024-01-15T10:30:00Z",
      "status": "completed"
    },
    {
      "externalCollectionRef": "CBU-2024-002",
      "clientResultId": "LAB-002",
      "usability": "unusable",
      "resultsDate": "2024-01-15T11:00:00Z",
      "status": "rejected",
      "labNote": "Contamination detected"
    }
  ]
}
```

#### Success Response

**Status: 200 OK** (or 207 Multi-Status for partial success)

```json
{
  "success": true,
  "summary": {
    "total": 2,
    "created": 2,
    "failed": 0,
    "skipped": 0
  },
  "results": [
    {
      "index": 0,
      "status": "created",
      "id": "generated-uuid-1",
      "collectionId": "uuid-1",
      "clientResultId": "LAB-001"
    },
    {
      "index": 1,
      "status": "created",
      "id": "generated-uuid-2",
      "collectionId": "resolved-uuid-2",
      "clientResultId": "LAB-002"
    }
  ]
}
```

#### Partial Success Response

**Status: 207 Multi-Status**

```json
{
  "success": false,
  "summary": {
    "total": 3,
    "created": 1,
    "failed": 1,
    "skipped": 1
  },
  "results": [
    {
      "index": 0,
      "status": "created",
      "id": "generated-uuid",
      "collectionId": "uuid-1"
    },
    {
      "index": 1,
      "status": "failed",
      "error": {
        "code": "COLLECTION_NOT_FOUND",
        "message": "Collection not found"
      }
    },
    {
      "index": 2,
      "status": "skipped",
      "reason": "Duplicate clientResultId",
      "existingId": "existing-uuid"
    }
  ]
}
```

---

### 3. Get Lab Result

**GET** `/api/v1/lab-results/{id}`

Retrieve a specific lab result by ID.

#### Success Response

**Status: 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "result-uuid",
    "collectionId": "collection-uuid",
    "usability": "usable",
    "resultsDate": "2024-01-15T10:30:00Z",
    "status": "completed",
    "createdAt": "2024-01-15T12:30:00Z",
    "updatedAt": "2024-01-15T12:30:00Z"
  }
}
```

---

### 4. Update Lab Result

**PATCH** `/api/v1/lab-results/{id}`

Update an existing lab result.

#### Request Body

```json
{
  "usability": "conditionally_usable",
  "labNote": "Updated after review",
  "status": "under_review"
}
```

#### Success Response

**Status: 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "result-uuid",
    "updatedAt": "2024-01-16T09:00:00Z"
  },
  "message": "Lab result updated successfully"
}
```

---

### 5. Get Lab Results by Collection

**GET** `/api/v1/collections/{collectionId}/lab-results`

Retrieve all lab results for a specific collection.

#### Success Response

**Status: 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "result-uuid-1",
      "usability": "usable",
      "resultsDate": "2024-01-15T10:30:00Z",
      "status": "completed"
    }
  ],
  "count": 1
}
```

---

## Field Reference

### Collection Identification

| Field | Type | Description |
|-------|------|-------------|
| `collectionId` | UUID | Direct collection UUID |
| `externalCollectionRef` | string | CBU number or legacy ID for lookup |
| `clientResultId` | string | External system's result ID (for idempotency) |

### Basic Information

| Field | Type | Description |
|-------|------|-------------|
| `usability` | string | Overall usability: `usable`, `unusable`, `conditionally_usable` |
| `resultsDate` | ISO8601 | Date/time results were generated |
| `labNote` | string | General laboratory notes |

### CBU Details

| Field | Type | Description |
|-------|------|-------------|
| `cbu` | string | CBU identifier |
| `collectionFor` | string | Purpose: `autologous`, `allogeneic`, `research` |
| `processing` | string | Processing method |
| `title` | string | Patient title |
| `firstName` | string | Patient first name |
| `surname` | string | Patient surname |
| `idBirthNumber` | string | Birth number/ID |
| `dateOfCollection` | ISO8601 | Collection date |
| `timeOfCollection` | string | Collection time (HH:MM) |
| `dateOfPrintingResults` | ISO8601 | Results printing date |
| `dateOfSendingResults` | ISO8601 | Results sending date |

### Sterility & Infection

| Field | Type | Description |
|-------|------|-------------|
| `sterility` | string | Sterility status: `negative`, `positive` |
| `sterilityType` | string | Test type: `aerobic`, `anaerobic`, `both` |
| `reasonForCharge` | string | Reason if charges apply |
| `transplantProcessing` | string | Transplant processing status |
| `resultOfSterility` | string | Sterility test result |
| `resultOfSterilityBagB` | string | Bag B sterility result |
| `infectionAgents` | string | Detected infection agents |
| `letterToPediatrician` | string | Letter status: `sent`, `pending`, `not_required` |
| `status` | string | Overall status: `pending`, `completed`, `rejected` |
| `finalAnalyses` | string | Final analysis status |

### Volume & Counts

| Field | Type | Description |
|-------|------|-------------|
| `tncCount` | string | Total nucleated cell count |
| `maxWeight` | string | Maximum weight (grams) |
| `volume` | string | Total volume (ml) |
| `volumeInBag` | string | Volume in primary bag (ml) |
| `volumeInSyringesBagB` | string | Volume in Bag B syringes (ml) |
| `volumeOfCpdInSyr` | string | CPD volume in syringes (ml) |

### Umbilical Tissue

| Field | Type | Description |
|-------|------|-------------|
| `umbilicalTissue` | string | Tissue collection status |
| `tissueProcessed` | string | Processing status: `yes`, `no` |
| `tissueSterility` | string | Tissue sterility result |
| `tissueInfectionAgents` | string | Tissue infection agents |
| `premiumStatus` | string | Premium processing status |
| `transferredTo` | string | Transfer destination |
| `tissueUsability` | string | Tissue usability status |

### Bag A Details

| Field | Type | Description |
|-------|------|-------------|
| `bagAUsability` | string | Bag A usability |
| `bagAVolume` | string | Bag A volume (ml) |
| `bagATnc` | string | Bag A TNC count |
| `bagAAtbSensit` | string | Antibiotic sensitivity |
| `bagABacteriaRisk` | string | Bacteria risk level |
| `bagAInfectionAgent` | string | Infection agent |
| `bagASignificance` | string | Clinical significance |

### Bag B Details

| Field | Type | Description |
|-------|------|-------------|
| `bagBUsability` | string | Bag B usability |
| `bagBVolume` | string | Bag B volume (ml) |
| `bagBTnc` | string | Bag B TNC count |
| `bagBAtbSensit` | string | Antibiotic sensitivity |
| `bagBBacteriaRisk` | string | Bacteria risk level |
| `bagBInfectionAgent` | string | Infection agent |
| `bagBSignificance` | string | Clinical significance |

---

## Rate Limiting

| Limit Type | Value | Window |
|------------|-------|--------|
| Requests per minute | 60 | 1 minute |
| Batch items per request | 100 | per request |
| Daily limit | 10,000 | 24 hours |

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705320000
```

### Rate Limit Exceeded Response

**Status: 429 Too Many Requests**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 30
  }
}
```

---

## Webhooks (Optional)

Configure webhooks to receive notifications when lab results are processed.

### Event: `lab_results.received`

Sent when a new lab result is successfully created.

#### Webhook Payload

```json
{
  "event": "lab_results.received",
  "timestamp": "2024-01-15T12:30:00Z",
  "data": {
    "labResultId": "result-uuid",
    "collectionId": "collection-uuid",
    "clientResultId": "LAB-001",
    "usability": "usable",
    "status": "completed"
  },
  "signature": "sha256=abc123..."
}
```

### Signature Verification (PHP Example)

```php
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$secret = 'your-webhook-secret';

$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}
```

---

## PHP Integration Example

### Single Result Submission

```php
<?php

class IndexusLabResultsClient
{
    private string $apiKey;
    private string $baseUrl;
    
    public function __construct(string $apiKey, string $baseUrl = 'https://your-domain.com/api/v1')
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }
    
    public function submitLabResult(array $data): array
    {
        $ch = curl_init($this->baseUrl . '/lab-results');
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $result = json_decode($response, true);
        
        if ($httpCode >= 400) {
            throw new Exception($result['error']['message'] ?? 'API Error', $httpCode);
        }
        
        return $result;
    }
    
    public function submitBatch(array $results): array
    {
        $ch = curl_init($this->baseUrl . '/lab-results/batch');
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['results' => $results]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
}

// Usage example
$client = new IndexusLabResultsClient('your-api-key');

try {
    $result = $client->submitLabResult([
        'externalCollectionRef' => 'CBU-2024-001',
        'clientResultId' => 'LAB-' . uniqid(),
        'usability' => 'usable',
        'resultsDate' => date('c'),
        'status' => 'completed',
        'tncCount' => '1.2e9',
        'volume' => '120',
        'sterility' => 'negative',
    ]);
    
    echo "Created lab result: " . $result['data']['id'];
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
```

### Batch Submission

```php
<?php

$results = [
    [
        'externalCollectionRef' => 'CBU-2024-001',
        'clientResultId' => 'LAB-001',
        'usability' => 'usable',
        'resultsDate' => '2024-01-15T10:00:00Z',
        'status' => 'completed',
    ],
    [
        'externalCollectionRef' => 'CBU-2024-002',
        'clientResultId' => 'LAB-002',
        'usability' => 'unusable',
        'resultsDate' => '2024-01-15T11:00:00Z',
        'status' => 'rejected',
        'labNote' => 'Contamination detected',
    ],
];

$response = $client->submitBatch($results);

echo "Created: " . $response['summary']['created'] . "\n";
echo "Failed: " . $response['summary']['failed'] . "\n";

foreach ($response['results'] as $item) {
    if ($item['status'] === 'created') {
        echo "Result {$item['clientResultId']} created with ID: {$item['id']}\n";
    } else {
        echo "Result at index {$item['index']} failed: {$item['error']['message']}\n";
    }
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_JSON` | 400 | Malformed JSON in request body |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key revoked or insufficient permissions |
| `COLLECTION_NOT_FOUND` | 404 | Referenced collection does not exist |
| `LAB_RESULT_NOT_FOUND` | 404 | Lab result not found |
| `DUPLICATE_RESULT` | 409 | Result with same clientResultId exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Security Recommendations

1. **HTTPS Only** - All API calls must use HTTPS
2. **API Key Rotation** - Rotate API keys every 90 days
3. **IP Whitelisting** - Optionally restrict API access to specific IPs
4. **Audit Logging** - All API calls are logged for audit purposes
5. **Idempotency** - Use `clientResultId` to prevent duplicate submissions

---

## Support

For API support or to request an API key, contact:
- Email: api-support@indexus.com
- Technical Documentation: https://docs.indexus.com/api

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial API release |

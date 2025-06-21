# Analytics Platform API Documentation

## Question Management Endpoints

### Submit New Question
```
POST /api/questions
Content-Type: application/json

{
  "text": "What's driving revenue this quarter?",
  "source": "web" // "web", "slack", "voice"
}

Response:
{
  "question": {
    "id": 123,
    "userId": 1,
    "text": "What's driving revenue this quarter?",
    "source": "web",
    "status": "queued",
    "result": null,
    "intent": {
      "pillars": ["monetization", "engagement"],
      "confidence": 0.85,
      "primaryPillar": "monetization"
    },
    "timestamp": "2025-06-09T17:30:00Z"
  }
}
```

### Update Question Status
```
PATCH /api/questions/:id/status
Content-Type: application/json

{
  "status": "ready", // "queued", "processing", "ready", "failed"
  "result": {
    "insights": ["Revenue increased 23% due to premium feature adoption"],
    "charts": ["revenue_trend_q2.png"],
    "recommendations": ["Focus on premium feature onboarding"]
  }
}

Response:
{
  "question": {
    "id": 123,
    "status": "ready",
    "result": { ... },
    // ... other fields
  }
}
```

### Get User Questions
```
GET /api/questions?limit=20

Response:
{
  "questions": [
    {
      "id": 123,
      "text": "What's driving revenue this quarter?",
      "status": "ready",
      "result": { ... },
      "timestamp": "2025-06-09T17:30:00Z"
    }
  ]
}
```

## Experiment Analysis Endpoints

### Submit Experiment Analysis Request
```
POST /api/experiments
Content-Type: application/json

{
  "name": "Boost Button Color Test",
  "hypothesis": "Green button will increase conversion by 15%",
  "metrics": ["conversion_rate", "click_through_rate"],
  "segments": ["new_users", "returning_users"]
}

Response:
{
  "experiment": {
    "id": 456,
    "name": "Boost Button Color Test",
    "status": "queued",
    "result": null,
    "timestamp": "2025-06-09T17:30:00Z"
  }
}
```

### Update Experiment Status
```
PATCH /api/experiments/:id/status
Content-Type: application/json

{
  "status": "ready",
  "result": {
    "winner": "variant_b",
    "confidence": 0.95,
    "lift": 0.18,
    "segments": {
      "new_users": { "lift": 0.23, "significance": true },
      "returning_users": { "lift": 0.12, "significance": false }
    }
  }
}
```

## Status Values

- **queued**: Analysis request received, waiting to be processed
- **processing**: Currently being analyzed by backend systems  
- **ready**: Analysis complete, results available
- **failed**: Analysis failed due to error

## WebSocket Events

The platform broadcasts real-time updates via WebSocket on `/ws`:

```json
{
  "type": "question_status_updated",
  "question": {
    "id": 123,
    "status": "ready",
    "result": { ... }
  }
}

{
  "type": "experiment_status_updated", 
  "experiment": {
    "id": 456,
    "status": "ready",
    "result": { ... }
  }
}
```

## Integration Examples

### Python Backend Integration
```python
import requests

# Update question status when analysis completes
def update_question_status(question_id, status, result=None):
    url = f"https://your-platform.replit.app/api/questions/{question_id}/status"
    payload = {
        "status": status,
        "result": result
    }
    response = requests.patch(url, json=payload)
    return response.json()

# Mark question as ready with results
update_question_status(123, "ready", {
    "insights": ["User engagement peaks at 2-3 PM daily"],
    "recommendations": ["Schedule push notifications during peak hours"]
})
```

### JavaScript Backend Integration
```javascript
// Update experiment status
async function updateExperimentStatus(experimentId, status, result) {
  const response = await fetch(`/api/experiments/${experimentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, result })
  });
  return response.json();
}

// Mark experiment as ready
await updateExperimentStatus(456, "ready", {
  winner: "variant_b",
  confidence: 0.95,
  lift: 0.18
});
```

## Error Handling

All endpoints return standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized
- 404: Resource not found
- 500: Internal server error

Error response format:
```json
{
  "error": "Question ID and status are required"
}
```
import httpx
 
async def fetch_data(initTime, endTime, auth):
    body = {
    "aggregateBy": [{
        "dataTypeName": "com.google.heart_rate.bpm"
    }],
    "bucketByTime": { "durationMillis": 60000 },
    "startTimeMillis": 1777400000000,
    "endTimeMillis": 1777488390517
    }
    async with httpx.AsyncClient() as client: 

        response = await client.get("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate")
        return response.json()
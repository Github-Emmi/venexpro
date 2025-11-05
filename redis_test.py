"""Basic connection example.
"""

import redis

r = redis.Redis(
    host='redis-14584.c52.us-east-1-4.ec2.redns.redis-cloud.com',
    port=14584,
    decode_responses=True,
    username="default",
    password="Bfu6KOOOCuabbx2Ij5gCEY2UIKPV0ymV",
)

success = r.set('foo', 'bar')
# True

result = r.get('foo')
print(result)
# >>> bar


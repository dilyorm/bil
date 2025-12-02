#!/bin/bash

# Basic API Tests for BIL System
# Run this script to test your API endpoints

BASE_URL=${1:-"http://localhost:3000"}
echo "Testing BIL API at: $BASE_URL"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test function
run_test() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local method="${4:-GET}"
    local data="$5"
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $test_name ... "
    
    if [[ "$method" == "POST" && -n "$data" ]]; then
        response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
    else
        response=$(curl -s -w "%{http_code}" "$url")
    fi
    
    status_code="${response: -3}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo -e "${GREEN}PASS${NC} (Status: $status_code)"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        fail_count=$((fail_count + 1))
    fi
}

# Test 1: Health Check
run_test "Health Check" "$BASE_URL/health" "200"

# Test 2: API Health Check
run_test "API Health Check" "$BASE_URL/api/health" "200"

# Test 3: Database Health Check
run_test "Database Health Check" "$BASE_URL/health/db" "200"

# Test 4: Redis Health Check
run_test "Redis Health Check" "$BASE_URL/health/redis" "200"

# Test 5: Non-existent endpoint (should return 404)
run_test "404 Test" "$BASE_URL/nonexistent" "404"

# Test 6: CORS preflight
echo -n "Test $((test_count + 1)): CORS Preflight ... "
test_count=$((test_count + 1))
cors_response=$(curl -s -w "%{http_code}" -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" "$BASE_URL/api/auth/login")
cors_status="${cors_response: -3}"
if [[ "$cors_status" == "200" || "$cors_status" == "204" ]]; then
    echo -e "${GREEN}PASS${NC} (Status: $cors_status)"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}FAIL${NC} (Status: $cors_status)"
    fail_count=$((fail_count + 1))
fi

# Test 7: Rate Limiting (make multiple requests quickly)
echo -n "Test $((test_count + 1)): Rate Limiting ... "
test_count=$((test_count + 1))
rate_limit_hit=false
for i in {1..20}; do
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/health")
    status_code="${response: -3}"
    if [[ "$status_code" == "429" ]]; then
        rate_limit_hit=true
        break
    fi
done

if [[ "$rate_limit_hit" == true ]]; then
    echo -e "${GREEN}PASS${NC} (Rate limiting active)"
    pass_count=$((pass_count + 1))
else
    echo -e "${YELLOW}SKIP${NC} (Rate limiting not triggered - may be configured for high limits)"
    # Don't count as pass or fail for development environment
fi

# Test 8: Security Headers
echo -n "Test $((test_count + 1)): Security Headers ... "
test_count=$((test_count + 1))
headers=$(curl -s -I "$BASE_URL/health")
security_headers_found=0

if echo "$headers" | grep -qi "x-frame-options"; then
    security_headers_found=$((security_headers_found + 1))
fi
if echo "$headers" | grep -qi "x-content-type-options"; then
    security_headers_found=$((security_headers_found + 1))
fi
if echo "$headers" | grep -qi "x-xss-protection"; then
    security_headers_found=$((security_headers_found + 1))
fi

if [[ $security_headers_found -ge 2 ]]; then
    echo -e "${GREEN}PASS${NC} (Found $security_headers_found security headers)"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}FAIL${NC} (Found only $security_headers_found security headers)"
    fail_count=$((fail_count + 1))
fi

# Test 9: JSON Response Format
echo -n "Test $((test_count + 1)): JSON Response Format ... "
test_count=$((test_count + 1))
health_response=$(curl -s "$BASE_URL/health")
if echo "$health_response" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC} (Valid JSON response)"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}FAIL${NC} (Invalid JSON response)"
    fail_count=$((fail_count + 1))
fi

# Test 10: Response Time
echo -n "Test $((test_count + 1)): Response Time ... "
test_count=$((test_count + 1))
response_time=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL/health")
response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)

if [[ $response_time_ms -lt 1000 ]]; then
    echo -e "${GREEN}PASS${NC} (${response_time_ms}ms < 1000ms)"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}FAIL${NC} (${response_time_ms}ms >= 1000ms)"
    fail_count=$((fail_count + 1))
fi

# Summary
echo ""
echo "=================================="
echo "Test Summary:"
echo "Total Tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo "Success Rate: $(echo "scale=1; $pass_count * 100 / $test_count" | bc -l)%"

if [[ $fail_count -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed! Your API is working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check your API configuration.${NC}"
    exit 1
fi
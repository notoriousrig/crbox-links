# Cloudflare Setup — links.crbox.ca

One-time wiring of DNS, Cloudflare Tunnel ingress, and Cloudflare Access
for `links.crbox.ca`. All three are done via the Cloudflare API.

Reference values (the secret token and the account/zone/tunnel IDs are in
`home_network/MEMORY.md` — never commit them to this repo):

- API token: `$CF_API_TOKEN` (from MEMORY.md)
- Account ID: `$CF_ACCOUNT_ID`
- Zone ID (crbox.ca): `$CF_ZONE_ID`
- Tunnel UUID: `$CF_TUNNEL_UUID`
- Team domain: `crbox.cloudflareaccess.com`
- `Allow-Chris` policy ID: `$CF_ACCESS_POLICY_ID`

Export them in your shell before running the snippets below:

```bash
export CF_API_TOKEN=...
export CF_ACCOUNT_ID=...
export CF_ZONE_ID=...
export CF_TUNNEL_UUID=...
export CF_ACCESS_POLICY_ID=...
```

## 1. DNS — CNAME `links.crbox.ca` to the tunnel

```bash
TOKEN="$CF_API_TOKEN"
ZONE="$CF_ZONE_ID"
TUNNEL="$CF_TUNNEL_UUID"

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"links\",\"content\":\"$TUNNEL.cfargotunnel.com\",\"proxied\":true}"
```

## 2. Tunnel ingress — insert before the 404 catch-all

```bash
ACCT="$CF_ACCOUNT_ID"
# Pull current config:
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/cfd_tunnel/$TUNNEL/configurations" > current.json
# Edit ingress[] to insert (before the http_status:404 entry):
#   { "hostname": "links.crbox.ca", "service": "http://traefik:8443" }
# Then PUT the modified config back:
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @new-config.json \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/cfd_tunnel/$TUNNEL/configurations"
```

## 3. Access app + policy

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCT/access/apps" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "crbox-links",
    "domain": "links.crbox.ca",
    "type": "self_hosted",
    "session_duration": "24h",
    "app_launcher_visible": true,
    "policies": ["'"$CF_ACCESS_POLICY_ID"'"]
  }'
```

Take the returned `aud` from `data.policies[0].aud` (or `data.aud`) and put
it into `.env` as `CF_ACCESS_AUD`. Redeploy the stack.

## Verifying

```bash
# Should redirect to Cloudflare Access login, not the app
curl -I https://links.crbox.ca

# Once authenticated in browser, /api/me should return your email
```

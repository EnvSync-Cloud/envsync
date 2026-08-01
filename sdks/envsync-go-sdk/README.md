# envsync-go-sdk

Generated Go client for the EnvSync API (Fern). Covers **product** routes (`/api/...`) and **Enterprise manage** routes (`/api/v1/manage/...`) on a **single** API origin.

Do not hand-edit `sdk/` — regenerate from monorepo OpenAPI (`packages/envsync-api/scripts/export-openapi.ts` → copy `openapi.json` here → `./generator.sh`).

There is no separate `envsync-management-go-sdk`.

## Multi-Org Bearer Token Usage

If one identity belongs to multiple organizations, bearer-token clients can
select the org for a single request by sending `X-EnvSync-Org-Id`.

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	authentication "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/authentication"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/option"
)

func main() {
	c := authentication.NewClient(
		option.WithBaseURL("https://api.envsync.cloud"),
		option.WithToken(os.Getenv("ENVSYNC_TOKEN")),
		option.WithHTTPHeader(http.Header{
			"X-EnvSync-Org-Id": []string{os.Getenv("ENVSYNC_ORG_ID")},
		}),
	)

	me, err := c.Whoami(context.Background())
	if err != nil {
		panic(err)
	}

	fmt.Println(me.GetOrg().GetId())
}
```

Notes:

- `X-EnvSync-Org-Id` is honored only for bearer-token requests.
- Cookie-session clients should continue using `POST /api/auth/switch-org`.
- API-key requests ignore this header.

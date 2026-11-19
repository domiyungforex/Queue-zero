# Cloudflare R2

The bucket stays private. The browser never receives the access key.

## Variables

Set these on the server only. They are listed in `.env.example`. Do not prefix them with `NEXT_PUBLIC_`.

| Name | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | R2 token secret |
| `R2_BUCKET_NAME` | Private bucket name |
| `R2_ENDPOINT` | Optional. Defaults to `https://<account id>.r2.cloudflarestorage.com` |

Leave them empty and uploads continue to the existing private Supabase bucket `attendance-photos`.

## Bucket

Create the bucket in Cloudflare with public access disabled. Do not attach a public `r2.dev` domain for student photographs. The application uses the S3 API from `@aws-sdk/client-s3`.

## Object keys

| Kind | Key |
| --- | --- |
| Attendance capture | `organizations/{organization}/{class}/{nonce}.jpg` |
| Profile photograph | `reference/{organization}/{image}.jpg` |
| Identified live check | `checks/{organization}/{class}/{image}.jpg` |

Keys use internal UUIDs. A matriculation or JAMB number is never part of the path. An attendance capture is not stored on the profile key, so it cannot replace the registration photograph.

A thumbnail key is `{name}.thumb.jpg`. It is written only when the photograph is already 80 KB or smaller. Larger photographs are served through `?variant=thumb`, which falls back to the original object. Tables request that variant and use `loading="lazy"`.

## Retrieval

Lecturers load `/api/school/attendance-photos/{attendance id}`. The route checks organization membership, then reads R2 or the old private bucket. It does not redirect to a permanent public URL.

A student identifying themselves may receive a signed download URL that expires in five minutes. That URL is not saved in Postgres.

## Cost

Cloudflare's published R2 free tier, as documented by Cloudflare, includes 10 GB-month of storage, 1 million Class A operations and 10 million Class B operations per month. Confirm the current figures in the Cloudflare dashboard before relying on them. This repository has not measured a bill.

## What was not done

No production bucket was created. No existing photograph was copied or deleted. Dashboard load time was not measured in a browser.

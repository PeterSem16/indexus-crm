# O2 IMS trunk on mediagtw

This integration is deliberately isolated from the existing SK and RO trunks.
The installer adds:

- `o2-ims-registration`, `o2-ims-auth`, `o2-ims-aor`, and `o2-ims-endpoint`;
- one or more IP-based identify objects generated from the current DNS answer;
- `from-o2-ims` inbound handling for `42122213323x` and `421940682394`;
- an explicit `route-o2-ims` outbound route using E.164 numbers;
- a ten-channel limit covering both inbound and outbound O2 calls.

The existing country routes remain the default. O2 is selected only when both
of these conditions are true:

1. the authenticated WebRTC call contains `X-Provider: O2-IMS`;
2. the authenticated PJSIP endpoint is enabled in the server-side AstDB
   entitlement list.

This is intentionally not added to the regular country fallback, so deploying
the trunk cannot silently move current SK, CZ, HU, DE, IT, or RO calls to O2.
The request header alone never grants access to the paid carrier route.

## Install on mediagtw

Copy the installer to `mediagtw`, inspect it, and run it locally as root:

```bash
sudo ./install-o2-ims-trunk.sh
```

The script asks for:

1. the exact outbound CLI, which must match `+42122213323x`;
2. the SIP password through hidden terminal input.

Do not put the password in a shell command, repository file, ticket, or chat.
For non-interactive maintenance, use a root-only one-line file with mode `0400`
or `0600` and set `O2_SIP_PASSWORD_FILE` in the process environment.

To install and reload in one step:

```bash
sudo ./install-o2-ims-trunk.sh --reload
```

Without `--reload`, the files are installed but Asterisk is not reloaded.
This is the safer option when the operator wants to inspect the generated
configuration first.

The script creates timestamped backups next to both existing configuration
files. It refuses to overwrite an existing managed O2 installation.

Before testing, authorize only the required extension:

```bash
sudo asterisk -rx "database put o2ims/allowed 2001 1"
```

Revoke access when the test is finished:

```bash
sudo asterisk -rx "database del o2ims/allowed 2001"
```

Use the exact authenticated endpoint object name from `pjsip show endpoints`
in place of `2001`. The dialplan reads it from `${CHANNEL(endpoint)}`; it does
not trust Caller ID or the SIP `From` number. A channel from any other endpoint
receives a rejected call even if it supplies the O2 provider header or spoofs
the caller ID of an entitled user.

## Validation

After reload, run:

```bash
sudo asterisk -rx "pjsip show registrations"
sudo asterisk -rx "pjsip show endpoint o2-ims-endpoint"
sudo asterisk -rx "pjsip show contacts"
sudo asterisk -rx "dialplan show route-o2-ims"
sudo asterisk -rx "dialplan show from-o2-ims"
```

Expected checks:

- `o2-ims-registration` is present and reaches `sipt1.ims.o2bs.sk:5060`;
- `o2-ims-endpoint` uses UDP and has `alaw`, `ulaw`, and `g729` configured;
- the generated identify object(s) match the current O2 provider address;
- inbound requests are identified only by provider IP, as required by O2;
- registration and outbound calls use `o2-ims-auth`; inbound calls do not
  receive a Digest challenge;
- `route-o2-ims` and `from-o2-ims` are loaded;
- no existing `trunk-sk-endpoint` or `trunk-ro-endpoint` object changed.

Then test, in this order:

1. a rejected outbound call from a non-entitled extension;
2. an outbound call from an entitled extension with `X-Provider: O2-IMS`;
3. an inbound call to one assigned `42122213323x` DID;
4. a rejected inbound call to an unassigned DID;
5. the `421940682394` DID if voice service is enabled on that number;
6. two-way audio, RFC 2833 DTMF, caller ID, and hangup in both directions;
7. eleven simultaneous calls to confirm the tenth is the last admitted call.

Do not enable full SIP debug while testing production calls. If SIP tracing is
necessary, redact authorization headers, phone numbers, and message bodies
before storing or sharing output.

## Rollback

Stop new test calls, restore the timestamped `pjsip.conf` and
`extensions.conf` backups, remove the three managed fragment files, and then
reload:

```bash
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
```

The installer does not remove backups automatically. Keep the selected backup
until registration and both call directions have been accepted.

If `--reload` fails, the installer restores both files, removes the generated
fragments, and reloads every configuration family whose reload was attempted.
If that recovery reload also fails, the installer prints an explicit warning
and the operator must perform the two reload commands above.
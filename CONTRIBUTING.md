# Contributing

Thanks for helping build Space Tech 3D / SpaceForge.

## Developer Certificate of Origin (DCO)

By contributing, you certify that you can submit the work under the Apache-2.0 license and agree to the [Developer Certificate of Origin](https://developercertificate.org/).

Sign every commit:

```bash
git commit -s -m "Your message"
```

The `-s` flag adds a `Signed-off-by:` line.

## Good first contributions

Prefer:

- CDS / rule-pack tests and documentation
- Component and materials catalog entries **with sources**
- University curriculum examples
- Bug fixes and CI improvements

Avoid (will be rejected):

- Custom geometry kernels or mesh-as-source-of-truth designs
- Export-controlled or proprietary datasets (see [EXPORT_CONTROL.md](EXPORT_CONTROL.md))
- Scope that skips the CubeSat Phase A MVP for megastructure demos

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @spacetech/web dev
```

## Pull requests

1. Fork and create a branch
2. Keep changes focused
3. Ensure CI passes
4. Use DCO sign-off
5. Describe what and why

## Code of conduct

Be respectful. Harassment and bad-faith contributions are not welcome. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

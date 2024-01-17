# Gitea publish generic packages action

An action to support publishing generic packages to Gitea.

## Inputs

The following are optional as `step.with` keys

| Name              | Type    | Optional | Description                                                                                 |
| ----------------- | ------- | -------- | ------------------------------------------------------------------------------------------- |
|  `api_url`        | String  | True     | The base gitea API url. Defaults to `github.api_url`                                        |
|  `owner`          | String  | True     | Assign an owner to this generic package. Defaults to `github.repository_owner`              |
|  `package_name`   | String  | True     | Gives the generic package a custom name. Defaults to `github.event.repository.name`         |
|  `package_version`| String  | True     | Gives a generic package version. Defaults to `github.ref_name`                              |
|  `files`          | String  | false    | Newline-delimited list of path globs for generic package files to upload                    |
|  `token`          | String  | false    | The Gitea personal access token                                                             |

## Example usage

```yaml
uses: VAllens/gitea-publish-generic-packages@v1
env:
  NODE_OPTIONS: '--experimental-fetch' # if nodejs < 18
with:
  files: |-
    bin/**
```

If you want to ignore ssl verify error, you can set env `NODE_TLS_REJECT_UNAUTHORIZED=false`

## References

- [actions/gitea-release-action: An action to support publishing release to Gitea.](https://gitea.com/actions/gitea-release-action)
- [Gr3q/gitea-api: Gitea API client.](https://github.com/Gr3q/gitea-api)
# TPX 文档

使用手册源文件在 [user/](user/getting-started/intro.md)，采用 TAP 的 Docusaurus 3.10.2 方案。原有技术文档仍保留在本目录。

```sh
cd docs
npm ci
npm run typecheck
npm run build
npm run serve
```

[版本与更新](user/reference/version.md)记录本轮核对范围。[部署说明](user/operate/deployment.md)说明站点 URL、基础路径与发布边界。CI 保存构建产物，cursor 构建通过后自动发布。

## 在线发布

站点地址：[TPX 使用手册](https://benjaminisgood.github.io/tpx-docs/)。原仓库保持私有，公开仓库 `Benjaminisgood/tpx-docs` 只保存 `docs/build/` 的静态产物。`cursor` 推送和该分支的手动工作流构建成功后发布，`main` 与 PR 只验证，不覆盖开发手册站。

`DOCS_DEPLOY_KEY` 是仅能写入本项目文档仓库的部署密钥，存于原仓库的 Actions secrets。站点根目录 `source-revision.txt` 记录源码提交，可用于核对是否已更新。发布范围不包含应用源码、运行配置、凭据或实验工作区。

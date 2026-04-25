每次都直接进你想看的页面。

推荐做法（最省事）
打开微信开发者工具顶部：普通编译旁边下拉 → 添加编译模式
新建一个模式，比如：checkin-dev
启动页面填：pages/checkin/checkin
需要的话可加 query 参数（你现在可不填）
保存后，把这个模式设为当前模式
之后每次保存自动编译，都会直接进 checkin 页面，不会先回首页。

再补两点优化
保留一个 home-dev 模式（pages/index/index），切功能时一键切换。
开发阶段尽量只改 checkin 页文件，避免触发全局重载（改 app.json、app.js 通常更容易回到入口流程）。
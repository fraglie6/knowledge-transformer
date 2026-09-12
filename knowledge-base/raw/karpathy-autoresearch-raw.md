# Karpathy autoresearch 原文摘录

> `program.md` 是一份 Markdown 文档，不是 Python 脚本。它描述了研究方法论——改什么、不改什么、怎么评估、怎么处理失败、以及一条铁律：**禁止向人类求助，一直跑。** 一个 coding agent 读这份文档，然后无限循环执行下去。
>
> 这就是 loop engineering 的核心模式：不给 agent 任务，给 agent **方法论**。让方法论成为 loop。一份 `program.md`，630 行胶水代码，剩下的全部是 agent 自己跑。
>
> 人不动代码，动方向；agent 不动方向，动代码。

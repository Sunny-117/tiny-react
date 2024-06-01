# mini-hooks

## 特性

1. useEffect 执行后，回调函数立即执行
2. 依赖的自变量变化后，回调函数立即执行
3. 不需要显示指明依赖

## 使用方法

```js
import { useState, useEffect } from 'mini-hooks';
const [count, setCount] = useState(0);

useEffect(() => {
	console.log('count: ', count());
});

useEffect(() => {
	console.log('do nothing');
});

setCount(2);
```

https://juejin.cn/column/7212249660579872826

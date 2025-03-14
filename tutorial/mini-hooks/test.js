import { useState, useEffect } from './index.js';
const [count, setCount] = useState(0);

useEffect(() => {
    console.log('count: ', count());
});

useEffect(() => {
    console.log('没我什么事');
});


setCount(2)
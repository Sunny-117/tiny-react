import { useEffect, useState } from 'react';

export default function Effect() {
	const [num, updateNum] = useState(0);
	useEffect(() => {
		console.log('App mount');
	}, []);
	useEffect(() => {
		console.log('num change create', num);
		return () => {
			console.log('num change destory', num);
		};
	}, [num]);
	return (
		<div onClick={() => updateNum(num + 1)}>
			{num === 0 ? <Child /> : 'npp'}
		</div>
	);
}

function Child() {
	useEffect(() => {
		console.log('Child mount');
		return () => {
			console.log('Child unmount');
		};
	}, []);
	return 'i am a child';
}

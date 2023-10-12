import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
	function DiffTest() {
		return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
	}
	return (
		<div>
			<DiffTest></DiffTest>
			<h4 onClick={() => setNum(num + 1)}>{num}</h4>
			<h4 onClickCapture={() => setNum(num + 1)}>{num}</h4>
			<Child />
		</div>
	);
}
function Child() {
	return <span>123</span>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

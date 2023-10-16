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
	function FragmentTest() {
		return (
			<>
				<div>1</div>
				<div>2</div>
			</>
		);
	}
	function FragmentTest2() {
		return (
			<ul>
				<>
					<li>1</li>
					<li>2</li>
				</>
				<li>3</li>
				<li>4</li>
			</ul>
		);
	}
	function FragmentTest3() {
		return (
			<ul onClickCapture={() => setNum(num + 1)}>
				<li>4</li>
				<li>5</li>
				{arr}
			</ul>
		);
	}
	function UpdateTest() {
		return (
			<ul
				onClickCapture={() => {
					setNum((num) => num + 1);
					setNum((num) => num + 1);
					setNum((num) => num + 1);
				}}
			>
				{num}
			</ul>
		);
	}
	return (
		<div>
			<DiffTest></DiffTest>
			<FragmentTest></FragmentTest>
			<FragmentTest2></FragmentTest2>
			<FragmentTest3></FragmentTest3>
			<UpdateTest></UpdateTest>
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

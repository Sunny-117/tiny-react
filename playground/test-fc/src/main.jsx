import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	return (
		<div>
			<h4>{num}</h4>
			<Child />
		</div>
	);
}
function Child() {
	return <span>123</span>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

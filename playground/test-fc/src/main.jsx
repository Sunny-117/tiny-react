import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	return (
		<div>
			<Child />
		</div>
	);
}
function Child() {
	return <span>123</span>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

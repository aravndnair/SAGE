export default function SearchBar({
	value,
	onChange,
	onSubmit,
	isSearching,
	inputRef,
}) {
	const canSubmit = Boolean(value && value.trim());

	const handleKeyDown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			onSubmit?.();
		}
	};

	return (
		<div className="search-bar">
			<div className="glass-panel search-bar-panel">
				<div className="search-bar-row">
					<div className="search-bar-icon" aria-hidden="true">
						<svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
							<path d="M8.5 15a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />
							<path d="M13.5 13.5 18 18" strokeLinecap="round" />
						</svg>
					</div>

					<input
						ref={inputRef}
						className="search-bar-input"
						type="text"
						placeholder="Search files here"
						value={value}
						onChange={(e) => onChange?.(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isSearching}
						autoFocus
					/>

					<div className="search-bar-actions">
						<button
							className="search-bar-submit"
							type="button"
							onClick={() => onSubmit?.()}
							disabled={isSearching || !canSubmit}
							aria-label="Search"
						>
							Search
						</button>
					</div>
				</div>

				<div className={isSearching ? 'search-bar-progress is-visible' : 'search-bar-progress'}>
					<div className="search-bar-progress-inner animate-shimmer" />
				</div>
			</div>
		</div>
	);
}

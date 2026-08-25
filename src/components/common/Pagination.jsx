import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export default function Pagination({ 
  totalItems, 
  itemsPerPage, 
  currentPage, 
  onPageChange, 
  onItemsPerPageChange,
  pageSizeOptions = [5, 15, 30, 50, 100]
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-left">
        <span className="pagination-text">
          Affichage de <strong>{startIndex}</strong> à <strong>{endIndex}</strong> sur <strong>{totalItems}</strong> entrées
        </span>
        <div className="page-size-selector">
          <span>Afficher</span>
          <select 
            className="page-size-select"
            value={itemsPerPage} 
            onChange={e => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>par page</span>
        </div>
      </div>

      <div className="pagination-right">
        <button 
          className="btn-page-action"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Page précédente"
        >
          <ChevronLeft size={16} /> Précédent
        </button>

        <div className="page-indicator">
          Page <strong>{currentPage}</strong> / {totalPages}
        </div>

        <button 
          className="btn-page-action"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Page suivante"
        >
          Suivant <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

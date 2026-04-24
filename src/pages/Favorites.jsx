import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import ProductCard from '../components/ProductCard';
import useCart from '../context/useCart';
import useProducts from '../context/useProducts';

/** Normalizes text for accent-insensitive and case-insensitive search. */
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Favorites page showing persisted favorite products.
 */
export default function Favorites() {
  const { cart, favorites, favoriteCount, dispatch, showToast, clearFavorites, restoreFavorites } = useCart();
  const { products } = useProducts();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [isAddAllConfirmOpen, setIsAddAllConfirmOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [undoFavoritesSnapshot, setUndoFavoritesSnapshot] = useState([]);
  const searchInputRef = useRef(null);
  const undoTimeoutRef = useRef(null);

  const favoriteProducts = products.filter((product) => favorites.includes(product.id));

  useEffect(() => {
    /** Shortcut: '/' focuses favorites search input when not typing in a field. */
    const handleKeydown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTypingField = targetTag === 'input' || targetTag === 'textarea' || event.target?.isContentEditable;
      if (!isTypingField && event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
  }, []);

  const totalFavoritesPrice = useMemo(
    () => favoriteProducts.reduce((sum, p) => sum + p.price, 0),
    [favoriteProducts]
  );

  const visibleFavorites = useMemo(() => {
    const searchValue = normalizeSearchText(search.trim());
    const filtered = !searchValue
      ? favoriteProducts
      : favoriteProducts.filter((product) => normalizeSearchText(`${product.name} ${product.category}`).includes(searchValue));

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });
  }, [favoriteProducts, search, sortBy]);

  const favoriteProductIds = useMemo(
    () => new Set(favoriteProducts.map((product) => product.id)),
    [favoriteProducts]
  );

  const cartProductIds = useMemo(
    () => new Set(cart.map((item) => item.id)),
    [cart]
  );

  const favoriteStats = useMemo(() => {
    const alreadyInCart = favoriteProducts.filter((product) => cartProductIds.has(product.id)).length;
    const newToCart = favoriteProducts.length - alreadyInCart;
    return { alreadyInCart, newToCart };
  }, [cartProductIds, favoriteProducts]);

  /** Adds only favorites not already present in cart. */
  const handleConfirmAddAllToCart = () => {
    const items = favoriteProducts
      .filter((product) => !cartProductIds.has(product.id))
      .map((product) => ({ ...product, quantity: 1 }));

    if (items.length === 0) {
      showToast('Todos tus favoritos ya están en el carrito.', 'info');
      setIsAddAllConfirmOpen(false);
      return;
    }

    dispatch({ type: 'ADD_ORDER_ITEMS', payload: { items } });
    showToast(
      `Agregaste ${items.length} favorito${items.length !== 1 ? 's' : ''} nuevos al carrito.`,
      'success'
    );
    setIsAddAllConfirmOpen(false);
  };

  /** Clears all favorites after user confirmation. */
  const handleConfirmClearFavorites = () => {
    const snapshot = [...favorites];
    clearFavorites();
    setUndoFavoritesSnapshot(snapshot);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    undoTimeoutRef.current = setTimeout(() => {
      setUndoFavoritesSnapshot([]);
      undoTimeoutRef.current = null;
    }, 7000);
    setIsClearConfirmOpen(false);
  };

  /** Restores favorites from the latest clear-all snapshot. */
  const handleUndoClearFavorites = () => {
    if (undoFavoritesSnapshot.length === 0) {
      return;
    }
    restoreFavorites(undoFavoritesSnapshot);
    setUndoFavoritesSnapshot([]);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  if (favoriteProducts.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4" aria-hidden="true">❤</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">No tienes favoritos todavía</h1>
        <p className="text-gray-500 mb-6">Marca productos con el botón Favorito para encontrarlos rápido.</p>
        <Link
          to="/"
          className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Explorar productos
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis favoritos</h1>
          <p className="text-gray-500">
            {favoriteCount} producto{favoriteCount !== 1 ? 's' : ''} guardado{favoriteCount !== 1 ? 's' : ''}.
          </p>
          <p className="text-sm font-semibold text-indigo-700 mt-1">
            Valor total: ${totalFavoritesPrice.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Mostrando {visibleFavorites.length} de {favoriteProducts.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsAddAllConfirmOpen(true)}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            disabled={favoriteProductIds.size === 0}
          >
            Agregar todo al carrito
          </button>
          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            disabled={favoriteProducts.length === 0}
          >
            Quitar todos
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Filtros de favoritos">
        <label className="md:col-span-2">
          <span className="sr-only">Buscar favoritos</span>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o categoría..."
            title="Atajo: /"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label>
          <span className="sr-only">Ordenar favoritos</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="name-asc">Nombre: A-Z</option>
            <option value="name-desc">Nombre: Z-A</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
          </select>
        </label>
      </section>

      {undoFavoritesSnapshot.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="status" aria-live="polite">
          <p className="text-sm text-amber-900">
            Se quitaron tus favoritos. Puedes deshacer esta acción durante unos segundos.
          </p>
          <button
            type="button"
            onClick={handleUndoClearFavorites}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            Deshacer
          </button>
        </div>
      )}

      <section
        aria-label="Lista de productos favoritos"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {visibleFavorites.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>

      {visibleFavorites.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-lg font-semibold text-gray-800">Sin resultados</p>
          <p className="text-sm text-gray-500 mt-1">Prueba con otro término o limpia el buscador.</p>
        </div>
      )}

      <ConfirmDialog
        open={isAddAllConfirmOpen}
        title="Agregar favoritos al carrito"
        message={`Se agregarán ${favoriteStats.newToCart} favorito${favoriteStats.newToCart !== 1 ? 's' : ''} nuevos. ${favoriteStats.alreadyInCart} ya están en el carrito y no se duplicarán.`}
        confirmLabel="Sí, agregar"
        cancelLabel="Cancelar"
        onCancel={() => setIsAddAllConfirmOpen(false)}
        onConfirm={handleConfirmAddAllToCart}
      />

      <ConfirmDialog
        open={isClearConfirmOpen}
        title="Quitar todos los favoritos"
        message={`Se quitarán ${favoriteProducts.length} producto${favoriteProducts.length !== 1 ? 's' : ''} de tu lista de favoritos.`}
        confirmLabel="Sí, quitar"
        cancelLabel="Cancelar"
        onCancel={() => setIsClearConfirmOpen(false)}
        onConfirm={handleConfirmClearFavorites}
        destructive
      />
    </main>
  );
}

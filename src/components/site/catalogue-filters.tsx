import Link from 'next/link'
import { Button } from '@/components/ui'

/**
 * Catalogue filter sidebar.
 *
 * A plain GET form, deliberately. Filters become URL parameters, which means
 * a filtered view is shareable, bookmarkable, back-button-correct and
 * server-rendered for crawlers — none of which a client-side filter state
 * gives you. It also works with JavaScript disabled.
 */

export interface FilterOption {
  value: string
  label: string
  children?: FilterOption[]
}

export function CatalogueFilters({
  basePath,
  current,
  categories,
  brands,
  countries,
  types,
  labels,
}: {
  basePath: string
  current: Record<string, string | string[] | undefined>
  categories?: FilterOption[]
  brands?: FilterOption[]
  countries?: FilterOption[]
  types?: FilterOption[]
  labels: {
    title: string
    search: string
    category?: string
    brand?: string
    country?: string
    type?: string
    apply: string
    clear: string
    allCategories?: string
    allBrands?: string
    allCountries?: string
    allTypes?: string
  }
}) {
  const value = (key: string): string => {
    const raw = current[key]
    return typeof raw === 'string' ? raw : ''
  }

  const hasFilters = ['q', 'category', 'brand', 'country', 'type'].some((key) =>
    value(key),
  )

  return (
    <aside>
      <form action={basePath} method="get" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
            {labels.title}
          </h2>
          {hasFilters && (
            <Link href={basePath} className="text-primary-700 text-xs hover:underline">
              {labels.clear}
            </Link>
          )}
        </div>

        <div>
          <label
            htmlFor="filter-q"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {labels.search}
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={value('q')}
            className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          />
        </div>

        {categories && categories.length > 0 && labels.category && (
          <SelectFilter
            id="filter-category"
            name="category"
            label={labels.category}
            placeholder={labels.allCategories ?? ''}
            options={categories}
            defaultValue={value('category')}
          />
        )}

        {brands && brands.length > 0 && labels.brand && (
          <SelectFilter
            id="filter-brand"
            name="brand"
            label={labels.brand}
            placeholder={labels.allBrands ?? ''}
            options={brands}
            defaultValue={value('brand')}
          />
        )}

        {types && types.length > 0 && labels.type && (
          <SelectFilter
            id="filter-type"
            name="type"
            label={labels.type}
            placeholder={labels.allTypes ?? ''}
            options={types}
            defaultValue={value('type')}
          />
        )}

        {countries && countries.length > 0 && labels.country && (
          <SelectFilter
            id="filter-country"
            name="country"
            label={labels.country}
            placeholder={labels.allCountries ?? ''}
            options={countries}
            defaultValue={value('country')}
          />
        )}

        <Button type="submit" block variant="secondary">
          {labels.apply}
        </Button>
      </form>
    </aside>
  )
}

function SelectFilter({
  id,
  name,
  label,
  placeholder,
  options,
  defaultValue,
}: {
  id: string
  name: string
  label: string
  placeholder: string
  options: FilterOption[]
  defaultValue: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <option value="">{placeholder}</option>
        {options.map((option) =>
          option.children && option.children.length > 0 ? (
            <optgroup key={option.value} label={option.label}>
              <option value={option.value}>{option.label}</option>
              {option.children.map((child) => (
                <option key={child.value} value={child.value}>
                  {'  '}
                  {child.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </div>
  )
}

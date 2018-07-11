/** @format */
/**
 * External dependencies
 */
import { expect } from 'chai';
import localforageMock from 'localforage';

/**
 * Internal dependencies
 */
import { cacheIndex } from '../cache-index';
import { RECORDS_LIST_KEY } from '../constants';
import { normalizeRequestParams } from '../utils';
import * as testData from './data';

jest.mock( 'localforage', () => require( './mocks/localforage' ) );

const localData = () => localforageMock.getLocalData();
const setLocalData = data => localforageMock.setLocalData( data );
const clearLocal = () => setLocalData( {} );

const ONE_DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

describe( 'cache-index', () => {
	beforeEach( clearLocal ); // also do inside nested blocks with >1 test

	describe( '#getAll', () => {
		beforeEach( clearLocal );

		test( 'should return undefined for empty localforage', () => {
			return cacheIndex.getAll().then( res => {
				expect( res ).to.equal( undefined );
			} );
		} );
		test( 'should return index from localforage and nothing else', () => {
			const { recordsList } = testData;
			setLocalData( {
				someStoredRecord: 1,
				someOtherRecord: 2,
				[ RECORDS_LIST_KEY ]: recordsList,
			} );
			return cacheIndex.getAll().then( res => {
				expect( res ).to.equal( recordsList );
			} );
		} );
	} );

	describe( '#addItem', () => {
		beforeEach( clearLocal ); // also do inside nested blocks with >1 test

		test( 'should add item to empty index', () => {
			const key = 'unique-key';
			return cacheIndex.addItem( key ).then( () => {
				const currentIndex = localforageMock.getLocalData()[ RECORDS_LIST_KEY ];
				expect( currentIndex ).to.be.an( 'array' );
				expect( currentIndex[ 0 ] ).to.have.property( 'key', key );
				expect( currentIndex[ 0 ] ).to.have.property( 'timestamp' );
			} );
		} );
		test( 'should store a pageSeriesKey when passed as third parameter', () => {
			const { postListKey, postListParams, postListPageSeriesKey } = testData;
			const normalizedParams = normalizeRequestParams( postListParams );
			return cacheIndex
				.addItem( postListKey, normalizedParams, postListPageSeriesKey )
				.then( () => {
					const currentIndex = localforageMock.getLocalData()[ RECORDS_LIST_KEY ];
					expect( currentIndex ).to.be.an( 'array' );
					expect( currentIndex[ 0 ] ).to.have.property( 'key', postListKey );
					expect( currentIndex[ 0 ] ).to.have.property( 'pageSeriesKey', postListPageSeriesKey );
					expect( currentIndex[ 0 ] ).to.have.property( 'timestamp' );
				} );
		} );
	} );

	describe( '#removeItem', () => {
		test( 'should remove item from a populated index', () => {
			const { postListKey, localDataFull } = testData;
			setLocalData( localDataFull );
			return cacheIndex.removeItem( postListKey ).then( () => {
				const currentIndex = localData()[ RECORDS_LIST_KEY ];
				expect( currentIndex.length ).to.eql( 2 );
			} );
		} );
	} );

	describe( '#pruneStaleRecords', () => {
		test( 'should prune old records', () => {
			const {
				postListKey,
				postListWithSearchKey,
				postListLocalRecord,
				postListWithSearchLocalRecord,
			} = testData;
			const now = Date.now();
			const yesterday = now - ONE_DAY_IN_MILLISECONDS;
			setLocalData( {
				[ postListKey ]: postListLocalRecord,
				[ postListWithSearchKey ]: postListWithSearchLocalRecord,
				[ RECORDS_LIST_KEY ]: [
					{ key: postListKey, timestamp: now },
					{ key: postListWithSearchKey, timestamp: yesterday },
				],
			} );
			return cacheIndex.pruneStaleRecords( 1000 * 60 * 60 ).then( () => {
				const freshData = localData();
				const currentIndex = freshData[ RECORDS_LIST_KEY ];
				expect( currentIndex ).to.eql( [ { key: postListKey, timestamp: now } ] );
				expect( freshData ).to.have.property( postListKey, postListLocalRecord );
				expect( freshData ).to.have.property( RECORDS_LIST_KEY );
				expect( freshData ).to.not.have.property( postListWithSearchKey );
			} );
		} );
	} );

	describe( '#clearAll', () => {
		test( 'should clear all sync records and nothing else', () => {
			const { localDataFull } = testData;
			setLocalData( Object.assign( { someRecord: 1 }, localDataFull ) );
			return cacheIndex.clearAll().then( () => {
				const freshData = localData();
				expect( freshData ).to.eql( { someRecord: 1 } );
			} );
		} );
	} );

	describe( '#clearPageSeries', () => {
		test( 'should clear records with matching pageSeriesKey and leave other records intact', () => {
			const {
				postListKey,
				postListNextPageKey,
				postListWithSearchKey,
				postListPageSeriesKey,
				postListDifferentPageSeriesKey,
				postListLocalRecord,
				postListNextPageParams,
				postListNextPageLocalRecord,
			} = testData;
			const now = Date.now();
			setLocalData( {
				someOtherRecord: 1,
				[ postListKey ]: postListLocalRecord,
				[ postListNextPageKey ]: postListNextPageLocalRecord,
				[ postListWithSearchKey ]: Object.assign( {}, postListLocalRecord ),
				[ RECORDS_LIST_KEY ]: [
					{ key: postListKey, pageSeriesKey: postListPageSeriesKey, timestamp: now },
					{ key: postListNextPageKey, pageSeriesKey: postListPageSeriesKey, timestamp: now },
					{
						key: postListWithSearchKey,
						pageSerieKey: postListDifferentPageSeriesKey,
						timestamp: now,
					},
				],
			} );
			return cacheIndex.clearPageSeries( postListNextPageParams ).then( () => {
				const freshData = localData();
				expect( freshData ).to.eql( {
					someOtherRecord: 1,
					[ postListWithSearchKey ]: postListLocalRecord,
					[ RECORDS_LIST_KEY ]: [
						{
							key: postListWithSearchKey,
							pageSerieKey: postListDifferentPageSeriesKey,
							timestamp: now,
						},
					],
				} );
			} );
		} );
	} );

	describe( '#clearRecordsByParamFilter', () => {
		test( 'should clear records with reqParams that matches filter and leave other records intact', () => {
			const {
				postListKey,
				postListParams,
				postListLocalRecord,
				postListDifferentSiteKey,
				postListDifferentSiteParams,
				postListDifferentSiteLocalRecord,
			} = testData;
			const now = Date.now();
			setLocalData( {
				[ postListKey ]: postListLocalRecord,
				[ postListDifferentSiteKey ]: postListDifferentSiteLocalRecord,
				[ RECORDS_LIST_KEY ]: [
					{
						key: postListKey,
						reqParams: postListParams,
						pageSeriesKey: 'doesnotmatter',
						timestamp: now,
					},
					{
						key: postListDifferentSiteKey,
						reqParams: postListDifferentSiteParams,
						pageSeriesKey: 'stilldoesnotmatter',
						timestamp: now,
					},
				],
			} );
			const matchSiteFilter = reqParams => {
				return reqParams.path === '/sites/bobinprogress2.wordpress.com/posts';
			};
			return cacheIndex.clearRecordsByParamFilter( matchSiteFilter ).then( () => {
				const freshData = localData();
				expect( freshData ).to.have.property( postListKey );
				expect( freshData ).to.not.have.property( postListDifferentSiteKey );
				expect( freshData[ RECORDS_LIST_KEY ].length ).to.eql( 1 );
			} );
		} );
	} );
} );

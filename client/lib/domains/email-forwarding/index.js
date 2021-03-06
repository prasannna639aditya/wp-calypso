/**
 * External dependencies
 */
import { mapValues, includes } from 'lodash';
import emailValidator from 'email-validator';

/**
 * Internal dependencies
 */
import { hasGSuite } from 'lib/domains/gsuite';
import { type as domainTypes } from 'lib/domains/constants';

/**
 * Retrieves the first domain that is eligible for Email Forwarding either from the current selected site or the list of domains.
 *
 * @param {String} selectedDomainName - domain name for the site currently selected by the user
 * @param {Array} domains - list of domain objects
 * @returns {String} - Eligible domain name
 */
function getEligibleEmailForwardingDomain( selectedDomainName, domains = [] ) {
	const eligibleDomains = getEmailForwardingSupportedDomains( domains );
	let domainName;
	if ( selectedDomainName ) {
		eligibleDomains.forEach( function( domain ) {
			domainName = domain.name === selectedDomainName && selectedDomainName;
		} );
	}
	return domainName || ( eligibleDomains.length && eligibleDomains[ 0 ].name ) || '';
}

/**
 * Filters a list of domains by the domains that eligible for Email Forwarding
 *
 * @param {Array} domains - list of domain objects
 * @returns {Array} - Array of Email Forwarding supported domans
 */
function getEmailForwardingSupportedDomains( domains ) {
	return domains.filter( function( domain ) {
		const domainHasGSuite = hasGSuite( domain );
		const wpcomHosted =
			includes( [ domainTypes.REGISTERED ], domain.type ) && domain.hasWpcomNameservers;
		const mapped = includes( [ domainTypes.MAPPED ], domain.type );
		return ( wpcomHosted || mapped ) && ! domainHasGSuite;
	} );
}

function validateAllFields( fieldValues ) {
	return mapValues( fieldValues, ( value, fieldName ) => {
		const isValid = validateField( {
			value,
			name: fieldName,
		} );

		return isValid ? [] : [ 'Invalid' ];
	} );
}

function validateField( { name, value } ) {
	switch ( name ) {
		case 'mailbox':
			return /^[a-z0-9._+-]{1,64}$/i.test( value ) && ! /(^\.)|(\.{2,})|(\.$)/.test( value );
		case 'destination':
			return emailValidator.validate( value );
		default:
			return true;
	}
}

export { getEligibleEmailForwardingDomain, getEmailForwardingSupportedDomains, validateAllFields };

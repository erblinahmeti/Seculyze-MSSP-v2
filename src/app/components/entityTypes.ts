import type { ComponentType } from 'react';
import {
  AppWindow,
  Archive,
  Binary,
  Bot,
  Box,
  Boxes,
  Bug,
  Cable,
  Cloud,
  Container,
  CopyCheck,
  File,
  FileBox,
  FolderKey,
  FolderTree,
  Globe,
  Hash,
  IdCard,
  Inbox,
  KeyRound,
  KeySquare,
  Layers2,
  Link,
  LockKeyhole,
  LogIn,
  Mail,
  Mails,
  MessageSquareText,
  Monitor,
  MonitorCheck,
  Network,
  Server,
  Settings2,
  Share2,
  ShieldUser,
  ShipWheel,
  Signpost,
  Terminal,
  Ticket,
  TriangleAlert,
  User,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';

// ─── Entity types ────────────────────────────────────────────────────────────
//
// Every entity type Sentinel can attach to an incident, keyed by the type name
// as it arrives. Each has a readable singular and plural (the raw names run
// words together: "Mailboxconfiguration"), and an icon.
//
// Order is the order an analyst scans for them: who, which machine, which
// address, what they touched — then everything else in Sentinel's own order.

type Icon = ComponentType<{ className?: string }>;
interface EntityType {
  singular: string;
  plural: string;
  icon: Icon;
}

const TYPES: [key: string, singular: string, plural: string, icon: Icon][] = [
  // Looked for first
  ['Account', 'account', 'accounts', User],
  ['Host', 'host', 'hosts', Monitor],
  ['IP', 'IP address', 'IP addresses', Globe],
  ['URL', 'URL', 'URLs', Link],
  ['File', 'file', 'files', File],
  ['File Hash', 'file hash', 'file hashes', Hash],
  ['Process', 'process', 'processes', Terminal],
  ['Mailbox', 'mailbox', 'mailboxes', Inbox],
  ['Mail Message', 'mail message', 'mail messages', Mail],
  ['Cloud Application', 'cloud application', 'cloud applications', AppWindow],
  // Then Sentinel's order
  ['AI Agent', 'AI agent', 'AI agents', Bot],
  ['Alerts', 'alert', 'alerts', TriangleAlert],
  ['Activedirectorydomain', 'Active Directory domain', 'Active Directory domains', Network],
  ['Azure Resource', 'Azure resource', 'Azure resources', Cloud],
  ['Blob', 'blob', 'blobs', FileBox],
  ['Blob Container', 'blob container', 'blob containers', Archive],
  ['Cloud Logon Request', 'cloud logon request', 'cloud logon requests', LogIn],
  ['Cloud Logon Session', 'cloud logon session', 'cloud logon sessions', IdCard],
  ['Container', 'container', 'containers', Container],
  ['Container Image', 'container image', 'container images', Layers2],
  ['Container Registry', 'container registry', 'container registries', Warehouse],
  ['DNS', 'DNS record', 'DNS records', Signpost],
  ['Domain Resource Identifier', 'domain resource identifier', 'domain resource identifiers', Server],
  ['Host Logon Session', 'host logon session', 'host logon sessions', MonitorCheck],
  ['K8s Cluster', 'K8s cluster', 'K8s clusters', ShipWheel],
  ['K8s Daemonset', 'K8s DaemonSet', 'K8s DaemonSets', Boxes],
  ['K8s Namespace', 'K8s namespace', 'K8s namespaces', FolderTree],
  ['K8s Pod', 'K8s pod', 'K8s pods', Box],
  ['K8s Replicaset', 'K8s ReplicaSet', 'K8s ReplicaSets', CopyCheck],
  ['K8s Secret', 'K8s secret', 'K8s secrets', KeyRound],
  ['K8s Serviceaccount', 'K8s service account', 'K8s service accounts', UserCog],
  ['Mail Cluster', 'mail cluster', 'mail clusters', Mails],
  ['Mailboxconfiguration', 'mailbox configuration', 'mailbox configurations', Settings2],
  ['Malware', 'malware', 'malware', Bug],
  ['Network Connection', 'network connection', 'network connections', Cable],
  ['OAuth Application', 'OAuth application', 'OAuth applications', KeySquare],
  ['Registry Key', 'registry key', 'registry keys', FolderKey],
  ['Registry Value', 'registry value', 'registry values', Binary],
  ['Resourceaccessinfo', 'resource access info', 'resource access info', LockKeyhole],
  ['SAS Token', 'SAS token', 'SAS tokens', Ticket],
  ['Security Group', 'security group', 'security groups', Users],
  ['Service Principal', 'service principal', 'service principals', ShieldUser],
  ['Srvsvcsessionentry', 'server session entry', 'server session entries', Share2],
  ['Teams Message', 'Teams message', 'Teams messages', MessageSquareText],
];

const BY_KEY = new Map<string, EntityType & { rank: number }>(
  TYPES.map(([key, singular, plural, icon], rank) => [key, { singular, plural, icon, rank }]),
);

/** An unknown type still renders: its raw name, a generic icon, sorted last. */
const lookup = (key: string) => BY_KEY.get(key);

export const entityIcon = (key: string): Icon => lookup(key)?.icon ?? Box;
export const entityRank = (key: string) => lookup(key)?.rank ?? TYPES.length;
/** "account" / "accounts" — lower-case, for use inside a sentence. */
export const entityLabel = (key: string, n: number) => {
  const t = lookup(key);
  return t ? (n === 1 ? t.singular : t.plural) : key;
};
/** "Accounts", "IP addresses", "K8s pods" — for a chip or heading. */
export const entityChipLabel = (key: string) => {
  const p = entityLabel(key, 2);
  return p.charAt(0).toUpperCase() + p.slice(1);
};

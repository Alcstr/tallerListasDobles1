class Node:
    def __init__(self, song_data):
        self.song_data = song_data
        self.next = None
        self.prev = None

class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.count = 0

    def append(self, song_data):
        new_node = Node(song_data)
        if self.head is None:
            self.head = new_node
            self.tail = new_node
        else:
            self.tail.next = new_node
            new_node.prev = self.tail
            self.tail = new_node
        self.count += 1

    def to_list_of_dicts(self):
        py_list = []
        current = self.head
        while current:
            py_list.append(current.song_data)
            current = current.next
        return py_list

    def find_node_at(self, index):
        if not (0 <= index < self.count):
            return None
        current = self.head
        for _ in range(index):
            current = current.next
        return current

    def remove_node(self, node):
        if node is None: return
        if node.prev:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        self.count -= 1
        node.next = None
        node.prev = None

    def insert_before(self, node_to_insert, reference_node):
        if node_to_insert is None: return
        if reference_node is None and self.head is not None:
             self.append(node_to_insert.song_data)
             return
        if self.head is None:
            self.head = node_to_insert
            self.tail = node_to_insert
            self.count += 1
            return
        node_to_insert.prev = reference_node.prev
        node_to_insert.next = reference_node
        if reference_node.prev:
            reference_node.prev.next = node_to_insert
        else:
            self.head = node_to_insert
        reference_node.prev = node_to_insert
        self.count += 1

    def move(self, from_index, to_index):
        if from_index == to_index: return
        node_to_move = self.find_node_at(from_index)
        if node_to_move is None: return
        self.remove_node(node_to_move)
        reference_node = self.find_node_at(to_index)
        self.insert_before(node_to_move, reference_node)

class MusicPlayer:
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MusicPlayer, cls).__new__(cls)
            cls._instance.playback_queue = DoublyLinkedList()
            cls._instance.current_song_node = None
            cls._instance.is_playing = False
        return cls._instance